/* eslint-disable no-await-in-loop */
const BaseService = require('../utils/_base.service');
const { Order, Product, Combo, Coupon, PricePromotion, Voucher } = require('../models');
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

  /* ============================================================
   * HELPER METHODS
   * ============================================================ */
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

  static calculatePromotionDiscount(originalPrice, promotion) {
    if (!promotion) return 0;
    let discountAmount = 0;
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
   * 1. BUILD ITEMS
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

        if (cartItem.itemType === 'Combo') {
          const combo = await Combo.findById(cartItem.item.id);
          if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

          let totalSurcharges = 0;
          let totalOptions = 0;
          let totalComponentBase = 0;
          let totalMarketPrice = 0;

          const selectionPromises = (cartItem.comboSelections || []).map(async (selection) => {
            const product = await Product.findById(selection.product.id);
            if (!product) throw new Error(`Món "${selection.productName}" không tồn tại`);

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

            if (combo.pricingMode === 'SLOT_PRICE') {
              totalComponentBase += slotPrice;
            } else if (combo.pricingMode === 'DISCOUNT') {
              totalComponentBase += product.basePrice;
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

          let priceAfterInternalLogic = 0;
          if (combo.pricingMode === 'FIXED') {
            priceAfterInternalLogic = combo.comboPrice;
          } else if (combo.pricingMode === 'SLOT_PRICE') {
            priceAfterInternalLogic = totalComponentBase;
          } else if (combo.pricingMode === 'DISCOUNT') {
            const discType = (combo.discountType || '').toLowerCase();
            if (discType === 'percentage' || discType === 'percent') {
              priceAfterInternalLogic = Math.round(totalComponentBase * (1 - combo.discountValue / 100));
            } else if (discType === 'fixed_amount' || discType === 'amount') {
              priceAfterInternalLogic = Math.max(0, totalComponentBase - combo.discountValue);
            } else {
              priceAfterInternalLogic = totalComponentBase;
            }
          } else {
            priceAfterInternalLogic = combo.comboPrice || 0;
          }

          const activePromo = await findActivePromotion(combo._id, 'combo');
          const promoDiscountAmount = OrderService.calculatePromotionDiscount(priceAfterInternalLogic, activePromo);
          const finalBasePrice = Math.max(0, priceAfterInternalLogic - promoDiscountAmount);
          const finalPrice = finalBasePrice + totalSurcharges + totalOptions;

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
          return { doc: { ...selection, options: normalizedOptions } };
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

  /* ============================================================
   * 2. LOGIC TÍNH DISCOUNT
   * ============================================================ */
  static async calculateTotalDiscount({ coupons = [], vouchers = [], orderTotal = 0 }) {
    let totalDiscountAmount = 0;
    const appliedDocs = [];
    const now = new Date();

    const calculateAmount = (valueType, value, maxDiscount, total) => {
      let amount = 0;
      if (valueType === 'percentage') {
        amount = Math.round(total * (value / 100));
        if (maxDiscount && maxDiscount > 0) {
          amount = Math.min(amount, maxDiscount);
        }
      } else {
        amount = value;
      }
      return amount;
    };

    // A. COUPONS
    if (Array.isArray(coupons) && coupons.length > 0) {
      for (const c of coupons) {
        const doc = await Coupon.findOne({
          _id: c.id,
          code: c.code,
          status: 'ACTIVE',
          startDate: { $lte: now },
          endDate: { $gte: now },
        });

        if (!doc) {
          logger.warn(`Coupon invalid: ${c.code}`);
          continue;
        }
        if (doc.maxUses > 0 && doc.usedCount >= doc.maxUses) continue;
        if (doc.minOrderAmount > 0 && orderTotal < doc.minOrderAmount) continue;

        const amount = calculateAmount(doc.valueType, doc.value, doc.maxDiscountAmount, orderTotal);
        totalDiscountAmount += amount;

        appliedDocs.push({
          code: doc.code,
          name: doc.name || doc.code,
          ref: doc._id,
          refModel: 'Coupon',
          discountType: doc.valueType,
          discountValue: doc.value,
          amount,
        });
      }
    }

    // B. VOUCHERS
    if (Array.isArray(vouchers) && vouchers.length > 0) {
      for (const v of vouchers) {
        const doc = await Voucher.findOne({
          _id: v.voucherId,
          code: v.voucherCode,
          status: 'UNUSED',
        }).populate('coupon');

        if (!doc) continue;
        if (doc.expiredAt && new Date(doc.expiredAt) < now) continue;
        if (doc.coupon && doc.coupon.minOrderAmount > 0 && orderTotal < doc.coupon.minOrderAmount) continue;

        const snapshot = doc.discountSnapshot;
        const amount = calculateAmount(snapshot.type, snapshot.value, snapshot.maxDiscount, orderTotal);
        totalDiscountAmount += amount;

        appliedDocs.push({
          code: doc.code,
          name: doc.coupon?.name || doc.code,
          ref: doc._id,
          refModel: 'Voucher',
          discountType: snapshot.type,
          discountValue: snapshot.value,
          amount,
        });
      }
    }

    totalDiscountAmount = Math.min(totalDiscountAmount, orderTotal);
    return { appliedDocs, totalDiscountAmount };
  }

  /* ============================================================
   * 3. PREPARE DATA
   * ============================================================ */
  async prepareOrderData(payload, { useMenuPrice = true } = {}) {
    const { items, coupons = [], vouchers = [] } = payload;

    const orderItems = useMenuPrice
      ? await OrderService.buildOrderItemsFromMenu(items)
      : OrderService.buildOrderItemsFromSnapshot(items);

    const totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);

    const { appliedDocs, totalDiscountAmount } = await OrderService.calculateTotalDiscount({
      coupons,
      vouchers,
      orderTotal: totalAmount,
    });

    const shippingFee = typeof payload.shippingFee === 'number' ? payload.shippingFee : 0;
    const grandTotal = Math.max(0, totalAmount - totalDiscountAmount + shippingFee);
    const orderCode = payload.orderCode || Date.now();
    const deliveryTime = payload.deliveryTime || { option: 'immediate', scheduledAt: null };

    const data = {
      ...payload,
      items: orderItems,
      appliedCoupons: appliedDocs,
      totalAmount,
      discountAmount: totalDiscountAmount,
      shippingFee,
      grandTotal,
      deliveryTime,
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

  /* ============================================================
   * 4. UPDATE USAGE (ĐÃ CẬP NHẬT LOGIC TĂNG PARENT COUPON)
   * ============================================================ */
  static async updateDiscountsUsage(appliedDocs = []) {
    if (!appliedDocs || appliedDocs.length === 0) return;

    // A. Cập nhật Coupon Public (Tăng usedCount)
    const couponIds = appliedDocs.filter((d) => d.refModel === 'Coupon').map((d) => d.ref);

    if (couponIds.length > 0) {
      await Coupon.updateMany({ _id: { $in: couponIds } }, { $inc: { usedCount: 1 } });
    }

    // B. Cập nhật Voucher Cá Nhân
    const voucherDocs = appliedDocs.filter((d) => d.refModel === 'Voucher');
    const voucherIds = voucherDocs.map((d) => d.ref);

    if (voucherIds.length > 0) {
      // 1. Đánh dấu Voucher là USED
      await Voucher.updateMany(
        { _id: { $in: voucherIds } },
        {
          status: 'USED',
          usedAt: new Date(),
        }
      );

      // 🔥 2. TÌM VÀ TĂNG USED COUNT CHO COUPON GỐC (PARENT)
      // Lấy danh sách các Coupon ID từ các Voucher vừa dùng
      const usedVouchers = await Voucher.find({ _id: { $in: voucherIds } }).select('coupon');
      const parentCouponIds = usedVouchers.map((v) => v.coupon).filter((id) => !!id);

      if (parentCouponIds.length > 0) {
        await Coupon.updateMany({ _id: { $in: parentCouponIds } }, { $inc: { usedCount: 1 } });
      }
    }
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

  /* ============================================================
   * 5. CONTROLLER ACTIONS
   * ============================================================ */
  async customerOrder(payload) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true });
    const order = await this.model.create(orderData);

    try {
      await OrderService.updatePromotionUsage(orderData.items);
      // 🔥 Gọi hàm update đã sửa logic
      await OrderService.updateDiscountsUsage(orderData.appliedCoupons);
    } catch (e) {
      logger.error('Error updating usage stats:', e);
    }

    return {
      message: orderData.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
      qrInfo: orderData.payment.method === 'payos' ? { checkoutUrl: orderData.payment.checkoutUrl } : null,
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

    const totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);

    let appliedDocs = existing.appliedCoupons || [];
    let totalDiscountAmount = existing.discountAmount || 0;

    if (payload.coupons || payload.vouchers) {
      const coupons = payload.coupons || [];
      const vouchers = payload.vouchers || [];
      const result = await OrderService.calculateTotalDiscount({ coupons, vouchers, orderTotal: totalAmount });
      appliedDocs = result.appliedDocs;
      totalDiscountAmount = result.totalDiscountAmount;
    }

    const shippingFee = typeof payload.shippingFee === 'number' ? payload.shippingFee : existing.shippingFee || 0;

    const updateDoc = {
      ...payload,
      items: orderItems,
      appliedCoupons: appliedDocs,
      totalAmount,
      discountAmount: totalDiscountAmount,
      grandTotal: Math.max(0, totalAmount - totalDiscountAmount + shippingFee),
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
