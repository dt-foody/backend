const BaseService = require('../utils/_base.service');
const { Order, Product, Combo, Coupon } = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');

class OrderService extends BaseService {
  constructor() {
    super(Order);
    this.payos = getPayOS();

    this.customerOrder = this.customerOrder.bind(this);
  }

  /* ============================================================
   * Convert FE options → flat array
   * ============================================================*/
  _normalizeOptions(optionsObj) {
    if (!optionsObj || typeof optionsObj !== "object") return [];

    const normalized = [];

    for (const groupName in optionsObj) {
      for (const opt of optionsObj[groupName]) {
        normalized.push({
          groupName,
          optionName: opt.name,
          priceModifier: opt.priceModifier || 0,
        });
      }
    }

    return normalized;
  }

  /* ============================================================
   * CUSTOMER ORDER
   * ============================================================*/
  async customerOrder(payload) {
    const { items, appliedCoupons } = payload;

    const orderItems = [];

    /* ============================================================
     * 1) Build lại từng OrderItem từ DB
     * ============================================================*/
    for (const cartItem of items) {
      let basePrice = 0;
      let finalPrice = 0;
      let normalizedOptions = [];

      /* ------------------------------------------------------------
       * PRODUCT
       * ------------------------------------------------------------*/
      if (cartItem.itemType === "Product") {
        const product = await Product.findById(cartItem.item.id);
        if (!product) throw new Error(`Sản phẩm không tồn tại: ${cartItem.item.name}`);

        // snapshot giá
        basePrice = product.basePrice;
        finalPrice = product.basePrice;

        // tính lại options
        normalizedOptions = this._normalizeOptions(cartItem.options);
        for (const opt of normalizedOptions) {
          finalPrice += opt.priceModifier;
        }

        orderItems.push({
          item: product._id,
          itemType: "Product",
          name: product.name,
          quantity: cartItem.quantity,

          basePrice,
          price: finalPrice,

          options: normalizedOptions,
          comboSelections: [],

          note: cartItem.note || "",
        });
      }

      /* ------------------------------------------------------------
       * COMBO
       * ------------------------------------------------------------*/
      if (cartItem.itemType === "Combo") {
        const combo = await Combo.findById(cartItem.item.id);
        if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

        // snapshot giá
        basePrice = combo.comboPrice;
        finalPrice = combo.comboPrice;

        orderItems.push({
          item: combo._id,
          itemType: "Combo",
          name: combo.name,
          quantity: cartItem.quantity,

          basePrice,
          price: finalPrice,

          options: [],
          comboSelections: [], // (bạn có thể thêm sau)

          note: cartItem.note || "",
        });
      }
    }

    /* ============================================================
     * 2) VERIFY & LOAD COUPONS
     * ============================================================*/
    const appliedCouponDocs = [];

    for (const cp of appliedCoupons || []) {
      const coupon = await Coupon.findById(cp.id);
      if (!coupon) throw new Error(`Coupon không hợp lệ: ${cp.code}`);

      appliedCouponDocs.push({
        id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      });
    }

    /* ============================================================
     * 3) CREATE ORDER
     * ============================================================*/
    const orderCode = Date.now();

    const orderData = {
      ...payload,
      items: orderItems,
      appliedCoupons: appliedCouponDocs,
      orderCode,

      payment: {
        method: payload.payment.method,
        status: "pending",
      },

      status: "pending",
    };

    /* ============================================================
     * 4) PAYOS (optional)
     * ============================================================*/
    if (payload.payment.method === "payos") {
      const qr = await this.generatePayOSQR({
        amount: payload.grandTotal,
        orderCode,
        description: `Order #${orderCode}`,
      });

      orderData.payment.transactionId = qr.transactionId;
      orderData.payment.qrCode = qr.qrCode;
      orderData.payment.checkoutUrl = qr.checkoutUrl;
    }

    /* ============================================================
     * 5) SAVE ORDER
     * ============================================================*/
    const order = await this.model.create(orderData);

    return {
      message:
        payload.payment.method === "payos"
          ? "Tạo đơn thành công, vui lòng quét QR."
          : "Tạo đơn thành công.",
      order,
    };
  }

  /* ============================================================
   * PAYOS HELPER
   * ============================================================*/
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
