const { PayOS } = require('@payos/node');
const config = require('./config');

let payosInstance = null;

/**
 * Singleton khởi tạo PayOS SDK
 * Đảm bảo chỉ tạo 1 lần trong toàn app.
 */
function initPayOS() {
  if (payosInstance) return payosInstance;

  if (!config.payos.client_id || !config.payos.api_key || !config.payos.checksum_key) {
    throw new Error('❌ PAYOS error setup.');
  }

  payosInstance = new PayOS({
    clientId: config.payos.client_id,
    apiKey: config.payos.api_key,
    checksumKey: config.payos.checksum_key,
  });

  return payosInstance;
}

/**
 * Lấy instance PayOS đã init
 */
function getPayOS() {
  if (!payosInstance) {
    return initPayOS();
  }
  return payosInstance;
}

module.exports = {
  initPayOS,
  getPayOS,
};
