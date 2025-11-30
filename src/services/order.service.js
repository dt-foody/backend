const BaseService = require('../utils/_base.service');
const { Order, Product, Combo, Coupon, PricePromotion } = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');
const logger = require('../config/logger');

const { getDistanceInKm } = require('../utils/map.util'); // Import util bản đồ
const { calculateShippingFeeByFormula } = require('../utils/shipping.util'); // Import util tính tiền

class OrderService extends BaseService {
  constructor() {
    super(Order);
    this.payos = getPayOS();

    // Bind methods
    this.customerOrder = this.customerOrder.bind(this);
    this.adminPanelCreateOrder = this.adminPanelCreateOrder.bind(this);
    this.adminPanelUpdateOrder = this.adminPanelUpdateOrder.bind(this);
    this.calculateShippingFee = this.calculateShippingFee.bind(this);
  }

  // eslint-disable-next-line class-methods-use-this
  async calculateShippingFee(customerLocation, orderTime) {
    const storeLoc = config.hereMap.storeLocation;

    // 1. Lấy khoảng cách từ Util
    const distance = await getDistanceInKm(storeLoc, customerLocation);

    // 2. Tính tiền từ Util (truyền orderTime vào)
    const shippingFee = calculateShippingFeeByFormula(distance, orderTime);

    return {
      distance: parseFloat(distance.toFixed(2)),
      shippingFee,
    };
  }

  /* ============================================================
   * 0. Chuẩn hoá options: { Size: [{name, priceModifier}], ... }
   * -> [{groupName, optionName, priceModifier}]
   * ============================================================ */
  static normalizeOptions(optionsObj) {
    if (!optionsObj || typeof optionsObj !== 'object') return [];

    return Object.entries(optionsObj).flatMap(([groupName, options]) => {
      return (options || []).map((opt) => ({
        groupName,
        optionName: opt.name,
        priceModifier: opt.priceModifier || 0,
      }));
    });
  }

  /* ============================================================
   * 1A. Build items từ DB (dùng cho CREATE -> snapshot theo menu hiện tại)
   * ============================================================ */
  static async buildOrderItemsFromMenu(items) {
    const now = new Date();

    // Helper: Tìm Promotion đang active
    const findActivePromotion = async (itemId, type = 'product') => {
      const query = {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        isDeleted: false,
      };

      if (type === 'product') query.product = itemId;
      if (type === 'combo') query.combo = itemId;

      // Tìm promotion ưu tiên cao nhất
      const promotion = await PricePromotion.findOne(query).sort({ priority: -1 });

      if (!promotion) return null;

      // Check giới hạn tổng
      if (promotion.maxQuantity > 0 && promotion.usedQuantity >= promotion.maxQuantity) {
        return null;
      }

      // Check giới hạn ngày
      if (promotion.dailyMaxUses > 0) {
        const isSameDay = promotion.lastUsedDate && new Date(promotion.lastUsedDate).toDateString() === now.toDateString();
        if (isSameDay && promotion.dailyUsedCount >= promotion.dailyMaxUses) {
          return null;
        }
      }
      return promotion;
    };

    // Helper: Tính số tiền được giảm
    const calculateDiscountAmount = (originalPrice, promotion) => {
      if (!promotion) return 0;
      let discountAmount = 0;

      if (promotion.discountType === 'percentage') {
        discountAmount = originalPrice * (promotion.discountValue / 100);
        if (promotion.maxDiscountAmount && promotion.maxDiscountAmount > 0) {
          if (discountAmount > promotion.maxDiscountAmount) {
            discountAmount = promotion.maxDiscountAmount;
          }
        }
      } else if (promotion.discountType === 'fixed_amount') {
        discountAmount = promotion.discountValue;
      }

      return discountAmount;
    };

    return Promise.all(
      items.map(async (cartItem) => {
        /* ------------------------------------------------------------------
         * TRƯỜNG HỢP 1: PRODUCT LẺ
         * ------------------------------------------------------------------ */
        if (cartItem.itemType === 'Product') {
          const product = await Product.findById(cartItem.item.id);
          if (!product) throw new Error(`Sản phẩm không tồn tại: ${cartItem.item.name}`);

          const activePromo = await findActivePromotion(product._id, 'product');

          const originalBasePrice = product.basePrice;
          let appliedPromotionId = null;
          let discountAmount = 0;

          if (activePromo) {
            discountAmount = calculateDiscountAmount(originalBasePrice, activePromo);
            appliedPromotionId = activePromo._id;
          }

          const basePrice = Math.max(0, originalBasePrice - discountAmount);

          const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);

          const finalPrice = basePrice + optionsPrice;

          return {
            item: product._id,
            itemType: 'Product',
            name: product.name,
            quantity: cartItem.quantity,
            originalBasePrice,
            basePrice,
            price: finalPrice,
            options: normalizedOptions,
            comboSelections: [],
            note: cartItem.note || '',
            promotion: appliedPromotionId,
          };
        }

        /* ------------------------------------------------------------------
         * TRƯỜNG HỢP 2: COMBO
         * ------------------------------------------------------------------ */
        if (cartItem.itemType === 'Combo') {
          const combo = await Combo.findById(cartItem.item.id);
          if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

          // A. Tìm Promotion cho Combo
          const activePromo = await findActivePromotion(combo._id, 'combo');
          let appliedPromotionId = null;
          let discountAmount = 0;

          // B. Tính giá gói Combo (Sau khi giảm giá)
          const originalComboPrice = combo.comboPrice || 0;
          if (activePromo) {
            discountAmount = calculateDiscountAmount(originalComboPrice, activePromo);
            appliedPromotionId = activePromo._id;
          }
          const comboBasePrice = Math.max(0, originalComboPrice - discountAmount);

          // C. Xử lý các món con (Selections)
          let totalMarketPriceOfComponents = 0;
          let totalOptionsSurcharge = 0;
          let totalProductSurcharge = 0; // Tổng tiền phụ thu các món

          const selectionPromises = (cartItem.comboSelections || []).map(async (selection) => {
            const product = await Product.findById(selection.product.id);
            if (!product) {
              throw new Error(`Món "${selection.productName}" trong combo không tồn tại`);
            }

            // --- [QUAN TRỌNG] Lấy additionalPrice từ cấu hình Combo trong DB ---
            let additionalPrice = 0;
            const comboSlotConfig = (combo.items || []).find((slot) => slot.slotName === selection.slotName);

            if (comboSlotConfig) {
              const productConfig = (comboSlotConfig.selectableProducts || []).find(
                (p) => p.product.toString() === product._id.toString()
              );
              if (productConfig) {
                additionalPrice = productConfig.additionalPrice || 0;
              }
            }
            // -------------------------------------------------------------------

            const normalizedOptions = OrderService.normalizeOptions(selection.options);
            const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);

            // Giá trị thực tế nếu mua lẻ = Giá gốc SP + Giá Options
            const componentMarketPrice = product.basePrice + optionsPrice;

            return {
              doc: {
                product: product._id,
                productName: product.name,
                basePrice: product.basePrice,
                // Lưu thêm additionalPrice vào snapshot để đối chiếu
                additionalPrice,
                options: normalizedOptions,
                slotName: selection.slotName,
              },
              marketPrice: componentMarketPrice,
              optionPrice: optionsPrice,
              additionalPrice,
            };
          });

          const resolvedSelections = await Promise.all(selectionPromises);

          // Tổng hợp số liệu
          totalMarketPriceOfComponents = resolvedSelections.reduce((sum, r) => sum + r.marketPrice, 0);
          totalOptionsSurcharge = resolvedSelections.reduce((sum, r) => sum + r.optionPrice, 0);
          totalProductSurcharge = resolvedSelections.reduce((sum, r) => sum + r.additionalPrice, 0);

          // D. Tính Final Price cho 1 Combo Item
          // = Giá gói Combo (đã giảm) + Tổng tiền Options + Tổng tiền phụ thu món (additionalPrice)
          const finalPrice = comboBasePrice + totalOptionsSurcharge + totalProductSurcharge;

          return {
            item: combo._id,
            itemType: 'Combo',
            name: combo.name,
            quantity: cartItem.quantity,

            // Giá trị thực tế của toàn bộ các món trong combo (để tính tiết kiệm)
            originalBasePrice: totalMarketPriceOfComponents,

            // Giá gói combo cơ bản (đã trừ khuyến mãi)
            basePrice: comboBasePrice,

            // Giá cuối cùng khách phải trả
            price: finalPrice,

            options: [],
            comboSelections: resolvedSelections.map((r) => r.doc),
            note: cartItem.note || '',
            promotion: appliedPromotionId,
          };
        }

        throw new Error('Loại item không xác định.');
      })
    );
  }

  /* ============================================================
   * 1B. Build items từ SNAPSHOT payload (dùng cho UPDATE admin)
   * -> KHÔNG query Product/Combo, giữ nguyên giá thời điểm đó
   * ============================================================ */
  static buildOrderItemsFromSnapshot(items) {
    if (!Array.isArray(items)) return [];

    return items.map((cartItem) => {
      const quantity = cartItem.quantity || 1;

      /* ---------------- PRODUCT ------------------- */
      if (cartItem.itemType === 'Product') {
        const basePrice = cartItem.item?.basePrice || 0;
        const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
        const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
        const finalPrice = basePrice + optionsPrice;

        return {
          item: cartItem.item.id,
          itemType: 'Product',
          name: cartItem.item.name,
          quantity,

          originalBasePrice: cartItem.originalBasePrice || basePrice, // Giữ nguyên snapshot
          basePrice,
          price: finalPrice,

          options: normalizedOptions,
          comboSelections: [],
          note: cartItem.note || '',
        };
      }

      /* ---------------- COMBO ------------------- */
      if (cartItem.itemType === 'Combo') {
        const comboPrice = cartItem.item.comboPrice || 0; // Giá này có thể hiểu là basePrice (giá gói)

        const selectionDocs = (cartItem.comboSelections || []).map((selection) => {
          const prodBasePrice = selection.product.basePrice || 0;
          const normalizedOptions = OrderService.normalizeOptions(selection.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);

          return {
            doc: {
              product: selection.product.id,
              productName: selection.product.name,
              basePrice: prodBasePrice,
              options: normalizedOptions,
              slotName: selection.slotName,
            },
            price: optionsPrice, // Chỉ lấy phần phụ thu option để cộng vào giá combo
          };
        });

        const totalOptionsPrice = selectionDocs.reduce((s, r) => s + r.price, 0);
        const finalPrice = comboPrice + totalOptionsPrice;

        return {
          item: cartItem.item.id,
          itemType: 'Combo',
          name: cartItem.item.name,
          quantity,

          originalBasePrice: cartItem.originalBasePrice || finalPrice, // Fallback
          basePrice: comboPrice,
          price: finalPrice,

          options: [],
          comboSelections: selectionDocs.map((r) => r.doc),
          note: cartItem.note || '',
        };
      }

      throw new Error('Loại item không xác định trong snapshot.');
    });
  }

  /* ============================================================
   * 2. Build coupons (luôn đọc lại từ DB)
   * ============================================================ */
  static async buildAppliedCoupons(appliedCoupons = []) {
    return Promise.all(
      (appliedCoupons || []).map(async (cp) => {
        const coupon = await Coupon.findById(cp.id);
        if (!coupon) throw new Error(`Coupon không hợp lệ: ${cp.code}`);

        return {
          id: coupon._id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
        };
      })
    );
  }

  /* ============================================================
   * 3. Gom logic build orderData (tính lại totals trong backend)
   * useMenuPrice = true -> dùng DB (create)
   * useMenuPrice = false -> dùng snapshot (update)
   * ============================================================ */
  async prepareOrderData(payload, { useMenuPrice = true } = {}) {
    const { items, appliedCoupons = [] } = payload;

    const orderItems = useMenuPrice
      ? await OrderService.buildOrderItemsFromMenu(items)
      : OrderService.buildOrderItemsFromSnapshot(items);

    const couponDocs = await OrderService.buildAppliedCoupons(appliedCoupons);

    const totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);

    const discountAmount = typeof payload.discountAmount === 'number' ? payload.discountAmount : 0;
    const shippingFee = typeof payload.shippingFee === 'number' ? payload.shippingFee : 0;

    const grandTotal = totalAmount - discountAmount + shippingFee;
    const orderCode = payload.orderCode || Date.now();

    const data = {
      ...payload,
      items: orderItems,
      appliedCoupons: couponDocs,
      totalAmount,
      discountAmount,
      shippingFee,
      grandTotal,
      orderCode,
      payment: {
        method: payload.payment?.method || 'cash',
        status: 'pending',
      },
      status: payload.status || 'pending',
    };

    // Nếu PayOS thì generate QR code
    if (data.payment.method === 'payos') {
      const qr = await this.generatePayOSQR({
        amount: grandTotal,
        orderCode,
        description: `Thanh toán đơn hàng #${orderCode}`,
      });

      data.payment.transactionId = qr.transactionId;
      data.payment.qrCode = qr.qrCode;
      data.payment.checkoutUrl = qr.checkoutUrl;
    }

    return data;
  }

  /* ============================================================
   * Helper: Cập nhật thống kê Promotion sau khi tạo đơn
   * (Dùng Pipeline Update để xử lý logic reset ngày tự động)
   * ============================================================ */
  static async updatePromotionUsage(orderItems) {
    const now = new Date();

    // Lọc ra các item có áp dụng promotion
    const promoItems = orderItems.filter((item) => item.promotion);

    if (promoItems.length === 0) return;

    // Duyệt và update từng promotion (Dùng Promise.all để chạy song song cho nhanh)
    await Promise.all(
      promoItems.map(async (item) => {
        // Logic:
        // 1. Tăng usedQuantity (tổng)
        // 2. Kiểm tra lastUsedDate:
        //    - Nếu CÙNG ngày hiện tại: dailyUsedCount = dailyUsedCount + quantity
        //    - Nếu KHÁC ngày (qua ngày mới): dailyUsedCount = quantity (reset và gán bằng số lượng mua)
        // 3. Cập nhật lastUsedDate = now

        return PricePromotion.updateOne({ _id: item.promotion }, [
          {
            $set: {
              // Tăng tổng số lượng đã dùng
              usedQuantity: { $add: ['$usedQuantity', item.quantity] },

              // Logic reset theo ngày
              dailyUsedCount: {
                $cond: {
                  if: {
                    // So sánh ngày trong DB với ngày hiện tại (YYYY-MM-DD)
                    $eq: [
                      { $dateToString: { format: '%Y-%m-%d', date: '$lastUsedDate' } },
                      { $dateToString: { format: '%Y-%m-%d', date: now } },
                    ],
                  },
                  then: { $add: ['$dailyUsedCount', item.quantity] }, // Cùng ngày -> cộng dồn
                  else: item.quantity, // Khác ngày -> reset về số lượng mua hiện tại
                },
              },

              // Cập nhật ngày dùng cuối
              lastUsedDate: now,
            },
          },
        ]);
      })
    );
  }

  /* ============================================================
   * 4. CREATE ORDER (FE user)
   * -> dùng giá từ DB (snapshot tại thời điểm tạo)
   * ============================================================ */
  async customerOrder(payload) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true });
    const order = await this.model.create(orderData);

    // 3. [QUAN TRỌNG] Cập nhật số lượng Promotion đã dùng
    // Nên để trong block try-catch hoặc chạy background để không chặn response nếu không quá quan trọng
    try {
      await OrderService.updatePromotionUsage(orderData.items);
    } catch (error) {
      logger.error('Lỗi cập nhật promotion usage:', error);
      // Tuỳ business: Có thể revert đơn hàng hoặc chỉ log lỗi để dev check
    }

    return {
      message: orderData.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
    };
  }

  /* ============================================================
   * 5. CREATE ORDER (Admin Panel)
   * -> giống create, nhưng message khác
   * ============================================================ */
  async adminPanelCreateOrder(payload) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true });
    const order = await this.model.create(orderData);

    return {
      message: 'Admin đã tạo đơn thành công.',
      order,
    };
  }

  /* ============================================================
   * 6. UPDATE ORDER (Admin Panel - full body)
   * - Dùng SNAPSHOT payload (KHÔNG query Product/Combo)
   * - Tính lại items + totals ở backend
   * ============================================================ */
  async adminPanelUpdateOrder(id, payload) {
    const existing = await this.model.findById(id);
    if (!existing) {
      throw new Error('Order không tồn tại');
    }

    // 1️⃣ Items: nếu FE gửi items -> build từ snapshot
    //            nếu KHÔNG gửi -> giữ nguyên items hiện có
    let orderItems;
    if (Array.isArray(payload.items)) {
      // full edit mode
      orderItems = OrderService.buildOrderItemsFromSnapshot(payload.items);
    } else {
      // metadata-only mode
      orderItems = existing.items || [];
    }

    // 2️⃣ Applied coupons: nếu gửi -> build lại, nếu không -> giữ nguyên
    const appliedCoupons = Array.isArray(payload.appliedCoupons)
      ? await OrderService.buildAppliedCoupons(payload.appliedCoupons)
      : existing.appliedCoupons || [];

    // 3️⃣ Tính lại totalAmount / grandTotal từ items + discount + shipping
    const totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);

    const discountAmount =
      typeof payload.discountAmount === 'number' ? payload.discountAmount : existing.discountAmount || 0;

    const shippingFee = typeof payload.shippingFee === 'number' ? payload.shippingFee : existing.shippingFee || 0;

    const grandTotal = totalAmount - discountAmount + shippingFee;

    // 4️⃣ Merge payment
    const updatedPayment = payload.payment
      ? {
          ...(existing.payment ? existing.payment.toObject?.() || existing.payment : {}),
          ...payload.payment,
        }
      : existing.payment;

    // 5️⃣ Build update doc
    const updateDoc = {
      // profile có thể cho phép đổi / không, tuỳ business
      profile: payload.profile !== undefined ? payload.profile : existing.profile,
      profileType: payload.profileType !== undefined ? payload.profileType : existing.profileType,
      status: payload.status || existing.status,

      items: orderItems,
      appliedCoupons,

      totalAmount,
      discountAmount,
      shippingFee,
      grandTotal,

      payment: updatedPayment,
      shipping: payload.shipping !== undefined ? payload.shipping : existing.shipping,

      note: payload.note !== undefined ? payload.note : existing.note,
      orderType: payload.orderType !== undefined ? payload.orderType : existing.orderType,
      channel: payload.channel !== undefined ? payload.channel : existing.channel,
    };

    const order = await this.model.findByIdAndUpdate(id, updateDoc, {
      new: true,
    });

    return {
      message: 'Admin đã cập nhật đơn thành công.',
      order,
    };
  }

  /* ============================================================
   * 7. PAYOS HELPER
   * ============================================================ */
  async generatePayOSQR({ amount, orderCode, description }) {
    const result = await this.payos.paymentRequests.create({
      amount,
      orderCode,
      description,
      returnUrl: config.payos.redirect_payment_success,
      cancelUrl: config.payos.redirect_payment_cancel,
    });

    const data = result.data || result;

    return {
      transactionId: data.id || data.transactionId,
      qrCode: data.qrCode,
      checkoutUrl: data.checkoutUrl || data.shortLink,
    };
  }
}

module.exports = new OrderService();
