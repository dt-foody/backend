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

  /**
   * Chuyển đổi object options từ FE sang mảng phẳng (flat array)
   * @param {object} optionsObj - Đối tượng options từ FE (vd: { Size: [...], Topping: [...] })
   * @returns {Array} - Mảng options đã được làm phẳng
   */
  static _normalizeOptions(optionsObj) {
    if (!optionsObj || typeof optionsObj !== 'object') return [];

    // Dùng Object.entries().flatMap() để duyệt và làm phẳng mảng
    // Vd: [ ['Topping', [opt1, opt2]], ['Size', [opt3]] ]
    // -> [ {groupName: 'Topping', ...}, {groupName: 'Topping', ...}, {groupName: 'Size', ...} ]
    return Object.entries(optionsObj).flatMap(([groupName, optionsArray]) => {
      // .map bên trong để biến đổi từng option
      return optionsArray.map((opt) => ({
        groupName,
        optionName: opt.name,
        priceModifier: opt.priceModifier || 0,
      }));
    });
  }

  /**
   * Xử lý đơn hàng từ phía khách hàng (Frontend)
   * @param {object} payload - Dữ liệu đơn hàng từ FE (đã qua Joi validation)
   * @returns {Promise<object>} - Kết quả tạo đơn hàng
   */
  async customerOrder(payload) {
    const { items, appliedCoupons } = payload;

    /* ============================================================
     * 1) Xây dựng lại Order Items từ DB (Dùng Promise.all)
     * ============================================================ */
    const orderItemPromises = items.map(async (cartItem) => {
      let basePrice = 0;
      let finalPrice = 0;

      /* ------------------------------------------------------------
       * TRƯỜNG HỢP 1: SẢN PHẨM (PRODUCT)
       * ------------------------------------------------------------*/
      if (cartItem.itemType === 'Product') {
        const product = await Product.findById(cartItem.item.id);
        if (!product) throw new Error(`Sản phẩm không tồn tại: ${cartItem.item.name}`);

        basePrice = product.basePrice;

        // Chuẩn hóa options
        const normalizedOptions = OrderService._normalizeOptions(cartItem.options);
        // Tính tổng giá options bằng .reduce()
        const optionsPrice = normalizedOptions.reduce((sum, opt) => sum + opt.priceModifier, 0);

        finalPrice = basePrice + optionsPrice;

        // Trả về object cho mảng items của Order
        return {
          item: product._id,
          itemType: 'Product',
          name: product.name, // Snapshot tên sản phẩm
          quantity: cartItem.quantity,
          basePrice, // Snapshot giá gốc
          price: finalPrice, // Giá cuối cùng đã tính lại
          options: normalizedOptions,
          comboSelections: [], // Product không có combo selections
          note: cartItem.note || '',
        };
      }

      /* ------------------------------------------------------------
       * TRƯỜNG HỢP 2: COMBO
       * ------------------------------------------------------------*/
      if (cartItem.itemType === 'Combo') {
        const combo = await Combo.findById(cartItem.item.id);
        if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

        basePrice = combo.comboPrice; // Giá gốc của combo (thường là 0)

        // Xử lý các sản phẩm con (selections) bên trong combo song song
        const selectionPromises = cartItem.comboSelections.map(async (selection) => {
          const product = await Product.findById(selection.product.id);
          if (!product) {
            throw new Error(`Sản phẩm "${selection.product.name}" trong combo "${combo.name}" không tồn tại`);
          }

          // Tính giá options của sản phẩm con
          const normalizedOptions = OrderService._normalizeOptions(selection.options);
          const optionsPrice = normalizedOptions.reduce((sum, opt) => sum + opt.priceModifier, 0);

          // Giá của selection này = giá gốc sp + giá options
          const selectionPrice = product.basePrice + optionsPrice;

          return {
            // Dữ liệu để lưu vào mảng comboSelections
            data: {
              // ✅ SỬA LỖI MONGOOSE TẠI ĐÂY
              product: product._id, // Khớp với model: 'product'
              productName: product.name, // Khớp với model: 'productName'

              basePrice: product.basePrice, // Snapshot giá gốc sp con
              options: normalizedOptions, // Options của sp con
              slotName: selection.slotName,
            },
            // Giá của selection này (để cộng vào giá tổng của combo)
            price: selectionPrice,
          };
        });

        // Chờ tất cả sản phẩm con được xử lý
        const resolvedSelections = await Promise.all(selectionPromises);

        // Tính tổng giá của các sản phẩm con
        const totalSelectionsPrice = resolvedSelections.reduce((sum, s) => sum + s.price, 0);
        // Giá cuối cùng của combo = giá gốc combo + tổng giá các sp con
        finalPrice = basePrice + totalSelectionsPrice;

        // Lấy mảng dữ liệu data của các selection đã xử lý
        const normalizedComboSelections = resolvedSelections.map((s) => s.data);

        // Trả về object cho mảng items của Order
        return {
          item: combo._id,
          itemType: 'Combo',
          name: combo.name, // Snapshot tên combo
          quantity: cartItem.quantity,
          basePrice, // Snapshot giá gốc combo
          price: finalPrice, // Giá cuối cùng đã tính lại
          options: [], // Combo không có options
          comboSelections: normalizedComboSelections, // Mảng các sp con
          note: cartItem.note || '',
        };
      }

      // Trường hợp này không bao giờ xảy ra nếu Joi validation hoạt động
      throw new Error('Loại item không xác định.');
    });

    // Chờ tất cả order items (products và combos) được xử lý song song
    const orderItems = await Promise.all(orderItemPromises);

    /* ============================================================
     * 2) Xác thực và Tải thông tin Coupons (Dùng Promise.all)
     * ============================================================ */
    const couponPromises = (appliedCoupons || []).map(async (cp) => {
      const coupon = await Coupon.findById(cp.id);
      if (!coupon) throw new Error(`Coupon không hợp lệ: ${cp.code}`);
      // (TODO: Thêm logic check điều kiện coupon nếu cần)

      // Snapshot lại thông tin coupon
      return {
        id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      };
    });

    const appliedCouponDocs = await Promise.all(couponPromises);

    /* ============================================================
     * 3) Tạo dữ liệu Order cuối cùng
     * ============================================================ */
    const orderCode = Date.now(); // Dùng cho PayOS

    const orderData = {
      ...payload, // Lấy shipping, note, totalAmount, grandTotal... từ FE
      items: orderItems, // Ghi đè bằng items đã xác thực
      appliedCoupons: appliedCouponDocs, // Ghi đè bằng coupons đã xác thực
      orderCode,
      payment: {
        method: payload.payment.method,
        status: 'pending', // Luôn là pending khi mới tạo
      },
      status: 'pending', // Trạng thái đơn hàng
      // profile: req.user.id, // (Bạn nên gán profile user ở đây nếu có)
    };

    /* ============================================================
     * 4) Tạo link thanh toán PayOS (Nếu có)
     * ============================================================ */
    if (payload.payment.method === 'payos') {
      // CẢNH BÁO: `payload.grandTotal` là giá từ FE.
      // Bạn NÊN tính toán lại `grandTotal` ở backend
      // dựa trên `orderItems`, `shippingFee` và `appliedCouponDocs`
      // để đảm bảo bảo mật 100%.
      const qr = await this.generatePayOSQR({
        amount: payload.grandTotal, // Tạm thời tin tưởng FE
        orderCode,
        description: `Thanh toan don hang #${orderCode}`,
      });

      orderData.payment.transactionId = qr.transactionId;
      orderData.payment.qrCode = qr.qrCode;
      orderData.payment.checkoutUrl = qr.checkoutUrl;
    }

    /* ============================================================
     * 5) Lưu Order vào DB
     * ============================================================ */
    const order = await this.model.create(orderData);

    // (TODO: Cập nhật tồn kho, tăng số lần dùng coupon...)

    // Trả về kết quả
    return {
      message: payload.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
      qrInfo:
        payload.payment.method === 'payos'
          ? {
              transactionId: orderData.payment.transactionId,
              qrCode: orderData.payment.qrCode,
              checkoutUrl: orderData.payment.checkoutUrl,
            }
          : null,
    };
  }

  /* ============================================================
   * PAYOS HELPER
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
