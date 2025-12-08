const express = require('express');

const router = express.Router();
const { getPayOS } = require('../../../config/payos');
const logger = require('../../../config/logger');
const { PayOSWebhookLog } = require('../../../models'); // model log webhook
const { orderService } = require('../../../services'); // model log webhook

const payos = getPayOS();

/**
 * PayOS webhook handler
 * - Verify chữ ký webhook
 * - Lưu toàn bộ body
 * - Xử lý khi code === "00" (thành công)
 */
router.post('/', async (req, res) => {
  const rawBody = req.body;

  try {
    // 🔹 Luôn log lại webhook dù verify fail
    const log = await PayOSWebhookLog.create({
      body: rawBody,
      orderCode: rawBody?.data?.orderCode,
      paymentLinkId: rawBody?.data?.paymentLinkId,
      reference: rawBody?.data?.reference,
    });

    logger.info('📩 PayOS Webhook Received:', rawBody);

    // 🔹 Xác thực chữ ký
    const verified = await payos.webhooks.verify(rawBody);
    logger.info('✅ Verified webhook data:', verified);

    // 🔹 Nếu verify OK → update log
    await log.updateOne({ verified: true, status: 'verified' });

    // 🔹 Check mã code phản hồi
    if (verified.code !== '00') {
      logger.warn('⚠️ PayOS webhook code != 00:', verified.code);
      await log.updateOne({
        status: 'invalid',
        verifyError: `Webhook code ${verified.code}`,
      });
      return res.status(400).json({
        error: -1,
        message: verified.desc || 'Webhook failed',
      });
    }

    // 🔹 Bỏ qua giao dịch test
    if (['Ma giao dich thu nghiem', 'VQRIO123'].includes(verified.data?.description)) {
      logger.info('ℹ️ Test transaction ignored');
      return res.json({
        error: 0,
        message: 'Test transaction ignored',
      });
    }

    // ✅ Thành công thực sự
    const { orderCode, amount } = verified;

    // TODO: cập nhật trạng thái đơn hàng trong DB
    await orderService.updateOne({ orderCode }, { 'payment.status': 'paid', status: 'confirmed' });

    logger.info('💰 Payment success:', { orderCode, amount });

    await log.updateOne({
      status: 'processed',
      processedAt: new Date(),
    });

    return res.json({
      error: 0,
      message: 'Payment verified successfully',
      data: verified,
    });
  } catch (err) {
    logger.error('❌ Webhook verify failed:', err);

    // 🔹 Ghi log lỗi nếu có
    try {
      await PayOSWebhookLog.create({
        body: rawBody,
        verified: false,
        verifyError: err.message,
        status: 'invalid',
      });
    } catch (_) {
      /* ignore logging error */
    }

    return res.status(200).json({
      error: -1,
      message: 'Invalid signature or verification failed',
    });
  }
});

// callback: https://luuchi.com.vn/v1/payos-webhook?status=CANCELLED&code=00&id=8f9bca17fd2f4c52a58b792cdd24c3a8&cancel=true&orderCode=1765206684327
// callback: Xử lý khi người dùng được PayOS redirect về sau khi thanh toán
router.get('/callback', async (req, res) => {
  try {
    const { orderCode, status, cancel, code } = req.query;
    const FRONTEND_BASE_URL = 'https://luuchi.com.vn/vi';

    // Log lại để debug
    logger.info('🔄 PayOS Callback received:', req.query);

    // 1. Trường hợp người dùng hủy thanh toán hoặc thanh toán lỗi
    if (cancel === 'true' || status === 'CANCELLED' || code !== '00') {
      logger.warn(`🚫 Order ${orderCode} cancelled or failed. Status: ${status}`);

      await orderService.updateOne(
        {
          orderCode: Number(orderCode), // Đảm bảo kiểu dữ liệu đúng
        },
        {
          status: 'canceled',
          'payment.status': 'failed',
          'payment.message': 'User cancelled or payment failed',
        }
      );

      // Redirect về trang thất bại (Bạn nên tạo trang này ở frontend)
      // Ví dụ: https://luuchi.com.vn/vi/payment-status?orderCode=...
      return res.redirect(`${FRONTEND_BASE_URL}/payment-status?orderCode=${orderCode}`);
    }

    // 2. Trường hợp thành công (code == '00')
    // Lưu ý: Việc update DB thành 'paid' đã được xử lý ở Webhook (router.post('/')).
    // Callback này chỉ làm nhiệm vụ điều hướng UX.

    logger.info(`✅ Redirecting user to success page for Order ${orderCode}`);

    // Redirect về frontend như yêu cầu
    return res.redirect(`${FRONTEND_BASE_URL}/payment-status?orderCode=${orderCode}`);
  } catch (err) {
    logger.error('❌ Callback error:', err);
    // Trường hợp lỗi server, redirect về trang chủ hoặc trang lỗi chung
    return res.redirect('https://luuchi.com.vn/vi/');
  }
});

module.exports = router;
