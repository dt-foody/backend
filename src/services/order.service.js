const BaseService = require('../utils/_base.service');
const { Order, Product, Combo, Coupon, PricePromotion } = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');
const logger = require('../config/logger');

const { getDistanceInKm } = require('../utils/map.util');
const { calculateShippingFeeByFormula } = require('../utils/shipping.util');

class OrderService extends BaseService {
  constructor() {
    super(Order);
    this.payos = getPayOS();
    this.customerOrder = this.customerOrder.bind(this);
    this.adminPanelCreateOrder = this.adminPanelCreateOrder.bind(this);
    this.adminPanelUpdateOrder = this.adminPanelUpdateOrder.bind(this);
    this.calculateShippingFee = this.calculateShippingFee.bind(this);
  }

  async calculateShippingFee(customerLocation, orderTime) {
    const storeLoc = config.hereMap.storeLocation;
    const distance = await getDistanceInKm(storeLoc, customerLocation);
    const shippingFee = calculateShippingFeeByFormula(distance, orderTime);
    return { distance: parseFloat(distance.toFixed(2)), shippingFee };
  }

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

  // Helper tính giảm giá Promotion
  // Đã fix lỗi case sensitivity (PERCENT vs percentage)
  static calculatePromotionDiscount(originalPrice, promotion) {
    if (!promotion) return 0;
    let discountAmount = 0;

    // Normalize: chuyển về chữ thường để so sánh
    const type = (promotion.discountType || '').toLowerCase();

    if (type === 'percentage' || type === 'percent') {
      discountAmount = originalPrice * (promotion.discountValue / 100);
      if (promotion.maxDiscountAmount && promotion.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
      }
    } else if (type === 'fixed_amount' || type === 'amount') {
      discountAmount = promotion.discountValue;
    }
    return Math.round(discountAmount);
  }

  /* ============================================================
   * 1A. BUILD ITEMS TỪ MENU (CREATE ORDER)
   * ============================================================ */
  static async buildOrderItemsFromMenu(items) {
    const now = new Date();

    const findActivePromotion = async (itemId, type = 'product') => {
      const query = {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        isDeleted: false,
      };
      if (type === 'product') query.product = itemId;
      if (type === 'combo') query.combo = itemId;

      const promotion = await PricePromotion.findOne(query).sort({ priority: -1 });
      if (!promotion) return null;
      if (promotion.maxQuantity > 0 && promotion.usedQuantity >= promotion.maxQuantity) return null;
      if (promotion.dailyMaxUses > 0) {
        const isSameDay = promotion.lastUsedDate && new Date(promotion.lastUsedDate).toDateString() === now.toDateString();
        if (isSameDay && promotion.dailyUsedCount >= promotion.dailyMaxUses) return null;
      }
      return promotion;
    };

    return Promise.all(
      items.map(async (cartItem) => {
        // --- 1. PRODUCT LẺ ---
        if (cartItem.itemType === 'Product') {
          const product = await Product.findById(cartItem.item.id);
          if (!product) throw new Error(`Sản phẩm không tồn tại: ${cartItem.item.name}`);

          const activePromo = await findActivePromotion(product._id, 'product');
          const originalBasePrice = product.basePrice;
          const discountAmount = OrderService.calculatePromotionDiscount(originalBasePrice, activePromo);
          const basePrice = Math.max(0, originalBasePrice - discountAmount);

          const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);

          return {
            item: product._id,
            itemType: 'Product',
            name: product.name,
            quantity: cartItem.quantity,
            originalBasePrice,
            basePrice,
            price: basePrice + optionsPrice,
            options: normalizedOptions,
            comboSelections: [],
            note: cartItem.note || '',
            promotion: activePromo ? activePromo._id : null,
          };
        }

        // --- 2. COMBO (ĐÃ FIX LOGIC DISCOUNT) ---
        if (cartItem.itemType === 'Combo') {
          const combo = await Combo.findById(cartItem.item.id);
          if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

          let totalSurcharges = 0;
          let totalOptions = 0;
          let totalComponentBase = 0; // Tổng giá gốc các món con
          let totalMarketPrice = 0;

          const selectionPromises = (cartItem.comboSelections || []).map(async (selection) => {
            const product = await Product.findById(selection.product.id);
            if (!product) throw new Error(`Món "${selection.productName}" không tồn tại`);

            // Tìm config slot
            let additionalPrice = 0;
            let slotPrice = 0;
            const comboSlotConfig = (combo.items || []).find((slot) => slot.slotName === selection.slotName);
            if (comboSlotConfig) {
              const productConfig = (comboSlotConfig.selectableProducts || []).find(
                (p) => p.product.toString() === product._id.toString()
              );
              if (productConfig) {
                additionalPrice = productConfig.additionalPrice || 0;
                slotPrice = productConfig.slotPrice || 0;
              }
            }

            const normalizedOptions = OrderService.normalizeOptions(selection.options);
            const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);

            totalSurcharges += additionalPrice;
            totalOptions += optionsPrice;
            totalMarketPrice += product.basePrice + optionsPrice + additionalPrice;

            // Logic tích luỹ giá trị nền
            if (combo.pricingMode === 'SLOT_PRICE') {
              totalComponentBase += slotPrice;
            } else if (combo.pricingMode === 'DISCOUNT') {
              totalComponentBase += product.basePrice; // Dùng giá gốc SP realtime
            }

            return {
              doc: {
                product: product._id,
                productName: product.name,
                basePrice: product.basePrice,
                additionalPrice,
                options: normalizedOptions,
                slotName: selection.slotName,
              },
            };
          });

          const resolvedSelections = await Promise.all(selectionPromises);

          // === START TÍNH TOÁN GIÁ COMBO ===

          // B1: Tính Internal Price (Giá Combo sau giảm giá nội bộ)
          let priceAfterInternalLogic = 0;

          if (combo.pricingMode === 'FIXED') {
            priceAfterInternalLogic = combo.comboPrice;
          } else if (combo.pricingMode === 'SLOT_PRICE') {
            priceAfterInternalLogic = totalComponentBase;
          } else if (combo.pricingMode === 'DISCOUNT') {
            // [QUAN TRỌNG] Normalize chuỗi "PERCENT" từ DB
            const discType = (combo.discountType || '').toLowerCase(); // "percent"

            if (discType === 'percentage' || discType === 'percent') {
              // Ví dụ: 70k * (1 - 0.1) = 63k
              priceAfterInternalLogic = Math.round(totalComponentBase * (1 - combo.discountValue / 100));
            } else if (discType === 'fixed_amount' || discType === 'amount') {
              priceAfterInternalLogic = Math.max(0, totalComponentBase - combo.discountValue);
            } else {
              // Fallback: Nếu data lỗi type thì lấy nguyên giá gốc
              priceAfterInternalLogic = totalComponentBase;
            }
          } else {
            priceAfterInternalLogic = combo.comboPrice || 0;
          }

          // B2: Tính External Promotion (Áp dụng lên giá đã giảm ở B1)
          const activePromo = await findActivePromotion(combo._id, 'combo');

          // Ví dụ: Giá 63k, Promo 10% -> Giảm tiếp 6.3k
          const promoDiscountAmount = OrderService.calculatePromotionDiscount(priceAfterInternalLogic, activePromo);

          // Final Base: 63k - 6.3k = 56.7k
          const finalBasePrice = Math.max(0, priceAfterInternalLogic - promoDiscountAmount);

          // B3: Tổng cuối cùng = Base + Phụ thu + Options
          const finalPrice = finalBasePrice + totalSurcharges + totalOptions;

          // === END TÍNH TOÁN ===

          return {
            item: combo._id,
            itemType: 'Combo',
            name: combo.name,
            quantity: cartItem.quantity,
            originalBasePrice: totalMarketPrice,
            basePrice: finalBasePrice,
            price: finalPrice,
            options: [],
            comboSelections: resolvedSelections.map((r) => r.doc),
            note: cartItem.note || '',
            promotion: activePromo ? activePromo._id : null,
          };
        }

        throw new Error('Loại item không xác định.');
      })
    );
  }

  // --- 1B. SNAPSHOT (Update logic) ---
  static buildOrderItemsFromSnapshot(items) {
    if (!Array.isArray(items)) return [];
    return items.map((cartItem) => {
      const quantity = cartItem.quantity || 1;

      if (cartItem.itemType === 'Product') {
        const basePrice = cartItem.basePrice || 0;
        const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
        const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
        return {
          ...cartItem,
          item: cartItem.item.id || cartItem.item,
          quantity,
          basePrice,
          price: basePrice + optionsPrice,
          options: normalizedOptions,
        };
      }

      if (cartItem.itemType === 'Combo') {
        const comboBasePrice = cartItem.basePrice || 0;
        let totalExtras = 0;

        const selectionDocs = (cartItem.comboSelections || []).map((selection) => {
          const normalizedOptions = OrderService.normalizeOptions(selection.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
          const additionalPrice = selection.additionalPrice || 0;
          totalExtras += optionsPrice + additionalPrice;

          return {
            doc: { ...selection, options: normalizedOptions },
          };
        });

        return {
          ...cartItem,
          item: cartItem.item.id || cartItem.item,
          quantity,
          basePrice: comboBasePrice,
          price: comboBasePrice + totalExtras,
          comboSelections: selectionDocs.map((r) => r.doc),
        };
      }
      return cartItem;
    });
  }

  static async buildAppliedCoupons(appliedCoupons = []) {
    return Promise.all(
      (appliedCoupons || []).map(async (cp) => {
        const coupon = await Coupon.findById(cp.id);
        if (!coupon) throw new Error(`Coupon không hợp lệ: ${cp.code}`);
        return { id: coupon._id, code: coupon.code, type: coupon.type, value: coupon.value };
      })
    );
  }

  async prepareOrderData(payload, { useMenuPrice = true } = {}) {
    const { items, appliedCoupons = [] } = payload;
    const orderItems = useMenuPrice
      ? await OrderService.buildOrderItemsFromMenu(items)
      : OrderService.buildOrderItemsFromSnapshot(items);

    const couponDocs = await OrderService.buildAppliedCoupons(appliedCoupons);
    const totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);
    const discountAmount = typeof payload.discountAmount === 'number' ? payload.discountAmount : 0;
    const shippingFee = typeof payload.shippingFee === 'number' ? payload.shippingFee : 0;
    const grandTotal = Math.max(0, totalAmount - discountAmount + shippingFee);
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
      payment: { method: payload.payment?.method || 'cash', status: 'pending' },
      status: payload.status || 'pending',
    };

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

  static async updatePromotionUsage(orderItems) {
    const now = new Date();
    const promoItems = orderItems.filter((item) => item.promotion);
    if (promoItems.length === 0) return;

    await Promise.all(
      promoItems.map(async (item) => {
        return PricePromotion.updateOne({ _id: item.promotion }, [
          {
            $set: {
              usedQuantity: { $add: ['$usedQuantity', item.quantity] },
              dailyUsedCount: {
                $cond: {
                  if: {
                    $eq: [
                      { $dateToString: { format: '%Y-%m-%d', date: '$lastUsedDate' } },
                      { $dateToString: { format: '%Y-%m-%d', date: now } },
                    ],
                  },
                  then: { $add: ['$dailyUsedCount', item.quantity] },
                  else: item.quantity,
                },
              },
              lastUsedDate: now,
            },
          },
        ]);
      })
    );
  }

  async customerOrder(payload) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true });
    const order = await this.model.create(orderData);
    try {
      await OrderService.updatePromotionUsage(orderData.items);
    } catch (e) {
      logger.error(e);
    }
    return {
      message: orderData.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
    };
  }

  async adminPanelCreateOrder(payload) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true });
    const order = await this.model.create(orderData);
    return { message: 'Admin đã tạo đơn thành công.', order };
  }

  async adminPanelUpdateOrder(id, payload) {
    const existing = await this.model.findById(id);
    if (!existing) throw new Error('Order không tồn tại');

    const orderItems = Array.isArray(payload.items)
      ? OrderService.buildOrderItemsFromSnapshot(payload.items)
      : existing.items || [];

    const appliedCoupons = Array.isArray(payload.appliedCoupons)
      ? await OrderService.buildAppliedCoupons(payload.appliedCoupons)
      : existing.appliedCoupons || [];

    const totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);
    const discountAmount =
      typeof payload.discountAmount === 'number' ? payload.discountAmount : existing.discountAmount || 0;
    const shippingFee = typeof payload.shippingFee === 'number' ? payload.shippingFee : existing.shippingFee || 0;

    const updateDoc = {
      ...payload,
      items: orderItems,
      appliedCoupons,
      totalAmount,
      grandTotal: Math.max(0, totalAmount - discountAmount + shippingFee),
      payment: payload.payment ? { ...existing.payment, ...payload.payment } : existing.payment,
    };

    const order = await this.model.findByIdAndUpdate(id, updateDoc, { new: true });
    return { message: 'Admin đã cập nhật đơn thành công.', order };
  }

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
