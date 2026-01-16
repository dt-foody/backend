const { getIO } = require('../config/socket');
const logger = require('../config/logger');

/**
 * Bắn sự kiện update đơn hàng trực tiếp vào Room cá nhân của User
 * @param {Object} order - Đơn hàng đầy đủ thông tin
 */
const emitOrderUpdate = (order) => {
  try {
    const io = getIO();
    if (!order) return;

    // Xác định User sở hữu đơn hàng
    // Logic này tùy thuộc vào model Order của bạn lưu 'customer' hay 'user' hay 'profile'
    const userId = order.customer?.id || order.customer || order.user?._id || order.user;

    if (userId) {
      // Gửi vào Room riêng của User
      // Event name chung là 'user_event' hoặc cụ thể 'order_update'
      io.to(`user-${userId}`).emit('order_update', {
        type: 'ORDER_UPDATE', // Loại sự kiện để FE phân loại
        payload: order, // Dữ liệu mới nhất
        message: `Đơn hàng #${order.orderId} đã chuyển sang: ${order.status}`,
      });

      logger.info(`Socket sent to user-${userId}: Order ${order.orderId} updated`);
    }
  } catch (error) {
    logger.error('Socket Emit Error:', error.message);
  }
};

module.exports = {
  emitOrderUpdate,
  // ... các hàm khác
};
