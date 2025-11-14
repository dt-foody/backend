const express = require('express');

const router = express.Router();
const { getPayOS } = require('../../../config/payos');

const payOS = getPayOS();

// 🟢 Tạo link thanh toán
router.post('/create', async (req, res) => {
  const { description, returnUrl, cancelUrl, amount } = req.body;

  const body = {
    orderCode: Date.now(),
    amount,
    description,
    returnUrl,
    cancelUrl,
  };

  try {
    const paymentLink = await payOS.createPaymentLink(body);

    return res.json({
      error: 0,
      message: 'Success',
      data: {
        bin: paymentLink.bin,
        accountName: paymentLink.accountName,
        accountNumber: paymentLink.accountNumber,
        amount: paymentLink.amount,
        description: paymentLink.description,
        orderCode: paymentLink.orderCode,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
      },
    });
  } catch (error) {
    console.error('❌ PayOS Error:', error);
    return res.json({ error: -1, message: 'Fail', data: null });
  }
});

// 🔵 Lấy thông tin đơn hàng
router.get('/:orderId', async (req, res) => {
  try {
    const order = await payOS.getPaymentLinkInfomation(req.params.orderId);
    if (!order) return res.json({ error: -1, message: 'Not found', data: null });
    return res.json({ error: 0, message: 'Success', data: order });
  } catch (error) {
    console.error(error);
    return res.json({ error: -1, message: 'Fail', data: null });
  }
});

// 🔴 Hủy thanh toán
router.put('/:orderId', async (req, res) => {
  try {
    const order = await payOS.cancelPaymentLink(req.params.orderId, req.body.cancellationReason);
    if (!order) return res.json({ error: -1, message: 'Not found', data: null });
    return res.json({ error: 0, message: 'Success', data: order });
  } catch (error) {
    console.error(error);
    return res.json({ error: -1, message: 'Fail', data: null });
  }
});

// 🟡 Xác nhận webhook URL (PayOS sẽ gửi ping)
router.post('/confirm-webhook', async (req, res) => {
  const { webhookUrl } = req.body;
  try {
    await payOS.confirmWebhook(webhookUrl);
    return res.json({ error: 0, message: 'Webhook confirmed', data: null });
  } catch (error) {
    console.error(error);
    return res.json({ error: -1, message: 'Fail', data: null });
  }
});

module.exports = router;
