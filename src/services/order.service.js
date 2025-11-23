const BaseService = require('../utils/_base.service');
const { Order, Product, Combo, Coupon } = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');

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
   *    -> [{groupName, optionName, priceModifier}]
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

          const selectionPromises = (cartItem.comboSelections || []).map(async (selection) => {
            const product = await Product.findById(selection.product.id);
            if (!product) {
              throw new Error(`Sản phẩm "${selection.product.name}" trong combo "${combo.name}" không tồn tại`);
            }

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
          finalPrice = (combo.comboPrice || 0) + totalSelectionsPrice;

          return {
            item: combo._id,
            itemType: 'Combo',
            name: combo.name,
            quantity: cartItem.quantity,
            basePrice: combo.comboPrice || 0,
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
   * 1B. Build items từ SNAPSHOT payload (dùng cho UPDATE admin)
   *     -> KHÔNG query Product/Combo, giữ nguyên giá thời điểm đó
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
          basePrice,
          price: finalPrice,
          options: normalizedOptions,
          comboSelections: [],
          note: cartItem.note || '',
        };
      }

      /* ---------------- COMBO ------------------- */
      if (cartItem.itemType === 'Combo') {
        const comboPrice = cartItem.item.comboPrice || 0;

        const selectionDocs = (cartItem.comboSelections || []).map((selection) => {
          const basePrice = selection.product.basePrice || 0;
          const normalizedOptions = OrderService.normalizeOptions(selection.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
          const selectionPrice = basePrice + optionsPrice;

          return {
            doc: {
              product: selection.product.id,
              productName: selection.product.name,
              basePrice,
              options: normalizedOptions,
              slotName: selection.slotName,
            },
            price: selectionPrice,
          };
        });

        const totalSelectionsPrice = selectionDocs.reduce((s, r) => s + r.price, 0);
        const finalPrice = comboPrice + totalSelectionsPrice;

        return {
          item: cartItem.item.id,
          itemType: 'Combo',
          name: cartItem.item.name,
          quantity,
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
   *    useMenuPrice = true -> dùng DB (create)
   *    useMenuPrice = false -> dùng snapshot (update)
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
   * 4. CREATE ORDER (FE user)
   *    -> dùng giá từ DB (snapshot tại thời điểm tạo)
   * ============================================================ */
  async customerOrder(payload) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true });
    const order = await this.model.create(orderData);

    return {
      message: orderData.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
    };
  }

  /* ============================================================
   * 5. CREATE ORDER (Admin Panel)
   *    -> giống create, nhưng message khác
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
   *    - Dùng SNAPSHOT payload (KHÔNG query Product/Combo)
   *    - Tính lại items + totals ở backend
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
