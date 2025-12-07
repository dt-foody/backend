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

module.exports = router;
