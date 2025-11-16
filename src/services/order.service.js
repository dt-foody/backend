const BaseService = require('../utils/_base.service');
const { Order, Product, Combo, Coupon } = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');

class OrderService extends BaseService {
  constructor() {
    super(Order);
    this.payos = getPayOS();

    // Bind methods
    this.createOrder = this.createOrder.bind(this);
    this.createAdminOrder = this.createAdminOrder.bind(this);
    this.updateOrder = this.updateOrder.bind(this);
  }

  /* ============================================================
   * 0. Chuẩn hoá options
   * ============================================================ */
  static normalizeOptions(optionsObj) {
    if (!optionsObj || typeof optionsObj !== 'object') return [];

    return Object.entries(optionsObj).flatMap(([groupName, options]) => {
      return options.map((opt) => ({
        groupName,
        optionName: opt.name,
        priceModifier: opt.priceModifier || 0,
      }));
    });
  }

  /* ============================================================
   * 1. Build lại items từ DB (Product + Combo)
   * ============================================================ */
  static async buildOrderItems(items) {
    return Promise.all(
      items.map(async (cartItem) => {
        let finalPrice = 0;

        /* ---------------- PRODUCT ------------------- */
        if (cartItem.itemType === 'Product') {
          const product = await Product.findById(cartItem.item.id);
          if (!product) throw new Error(`Sản phẩm không tồn tại: ${cartItem.item.name}`);

          const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
          finalPrice = product.basePrice + optionsPrice;

          return {
            item: product._id,
            itemType: 'Product',
            name: product.name,
            quantity: cartItem.quantity,
            basePrice: product.basePrice,
            price: finalPrice,
            options: normalizedOptions,
            comboSelections: [],
            note: cartItem.note || '',
          };
        }

        /* ---------------- COMBO ------------------- */
        if (cartItem.itemType === 'Combo') {
          const combo = await Combo.findById(cartItem.item.id);
          if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

          const selectionPromises = cartItem.comboSelections.map(async (selection) => {
            const product = await Product.findById(selection.product.id);
            if (!product) throw new Error(`Sản phẩm "${selection.product.name}" trong combo "${combo.name}" không tồn tại`);

            const normalizedOptions = OrderService.normalizeOptions(selection.options);
            const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
            const selectionPrice = product.basePrice + optionsPrice;

            return {
              data: {
                product: product._id,
                productName: product.name,
                basePrice: product.basePrice,
                options: normalizedOptions,
                slotName: selection.slotName,
              },
              price: selectionPrice,
            };
          });

          const resolved = await Promise.all(selectionPromises);
          const totalSelectionsPrice = resolved.reduce((s, r) => s + r.price, 0);
          finalPrice = combo.comboPrice + totalSelectionsPrice;

          return {
            item: combo._id,
            itemType: 'Combo',
            name: combo.name,
            quantity: cartItem.quantity,
            basePrice: combo.comboPrice,
            price: finalPrice,
            options: [],
            comboSelections: resolved.map((r) => r.data),
            note: cartItem.note || '',
          };
        }

        throw new Error('Loại item không xác định.');
      })
    );
  }

  /* ============================================================
   * 2. Build coupons
   * ============================================================ */
  static async buildAppliedCoupons(appliedCoupons = []) {
    return Promise.all(
      appliedCoupons.map(async (cp) => {
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
   * 3. Gom toàn bộ logic tạo orderObject
   * ============================================================ */
  async prepareOrderData(payload) {
    const { items, appliedCoupons } = payload;

    const orderItems = await OrderService.buildOrderItems(items);
    const couponDocs = await OrderService.buildAppliedCoupons(appliedCoupons);

    const orderCode = Date.now();

    const data = {
      ...payload,
      items: orderItems,
      appliedCoupons: couponDocs,
      orderCode,
      payment: {
        method: payload.payment.method,
        status: 'pending',
      },
      status: 'pending',
    };

    if (payload.payment.method === 'payos') {
      const qr = await this.generatePayOSQR({
        amount: payload.grandTotal,
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
   * 4. CREATE ORDER (FE)
   * ============================================================ */
  async createOrder(payload) {
    const orderData = await OrderService.prepareOrderData(payload);
    const order = await this.model.create(orderData);

    return {
      message: orderData.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
    };
  }

  /* ============================================================
   * 5. CREATE ORDER (Admin Panel)
   * ============================================================ */
  async createAdminOrder(payload) {
    const orderData = await OrderService.prepareOrderData(payload);
    const order = await this.model.create(orderData);

    return {
      message: 'Admin đã tạo đơn thành công.',
      order,
    };
  }

  /* ============================================================
   * 6. UPDATE ORDER (FE hoặc Admin)
   * ============================================================ */
  async updateOrder(id, payload) {
    const order = await this.model.findById(id);
    if (!order) throw new Error('Không tìm thấy đơn hàng.');

    // Build lại items + coupons
    const rebuiltData = await this.prepareOrderData(payload);

    // Merge vào order hiện tại
    Object.assign(order, rebuiltData);

    await order.save();
    return order;
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
