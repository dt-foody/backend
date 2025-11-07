const BaseService = require('../utils/_base.service');
const { Order } = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');

class OrderService extends BaseService {
  constructor() {
    super(Order);
    this.payos = getPayOS(); // ✅ dùng instance chung
    this.customerOrder = this.customerOrder.bind(this);
  }

  async customerOrder(payload) {
    const orderCode = Date.now(); // ✅ numeric orderCode
    const paymentMethod = payload.payment && payload.payment.method || 'cash';

    const orderData = {
      ...payload,
      orderCode,
      status: 'pending',
      payment: {
        ...(payload.payment || {}),
        status: 'pending',
      },
    };

    let qrInfo = null;

    if (paymentMethod === 'payos') {
      try {
        const qr = await this.generatePayOSQR({
          amount: payload.grandTotal,
          orderCode,
          description: `Order #${orderCode}`,
        });

        qrInfo = qr;
        orderData.payment.transactionId = qr.transactionId;
        orderData.payment.qrCode = qr.qrCode;
        orderData.payment.checkoutUrl = qr.checkoutUrl;
      } catch (err) {
        console.error('PayOS Error:', err.message);
        throw new Error('Không thể tạo mã QR thanh toán. Vui lòng thử lại sau.');
      }
    }

    const order = await this.model.create(orderData);

    return {
      message:
        paymentMethod === 'payos'
          ? 'Tạo đơn hàng thành công. Vui lòng quét mã QR để thanh toán.'
          : 'Tạo đơn hàng thành công, chờ xác nhận từ hệ thống.',
      order,
      qrInfo,
    };
  }

  async generatePayOSQR({ amount, orderCode, description }) {
    const result = await this.payos.paymentRequests.create({
      orderCode,
      amount,
      description,
      returnUrl:
        config.payos.redirect_payment_success ||
        'https://yourdomain.com/payment-success',
      cancelUrl:
        config.payos.redirect_payment_cancel ||
        'https://yourdomain.com/payment-cancel',
    });

    const data = result.data ? result.data : result;
    return {
      transactionId: data.id || data.transactionId,
      qrCode: data.qrCode,
      checkoutUrl: data.checkoutUrl || data.shortLink,
    };
  }
}

module.exports = new OrderService();
