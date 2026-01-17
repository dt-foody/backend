const { getIO } = require('../config/socket');
const logger = require('../config/logger');
const { Customer, Employee } = require('../models');

/**
 * Bắn sự kiện update đơn hàng trực tiếp vào Room cá nhân của User
 * @param {Object} order - Đơn hàng đầy đủ thông tin
 */
const emitOrderUpdate = async (order) => {
  try {
    if (!order) {
      return;
    }

    const profile =
      order.profileType === 'Customer'
        ? await Customer.findOne({
            _id: order.profile,
          })
        : await Employee.findOne({
            _id: order.profile,
          });

    if (!profile) {
      logger.warn(`Cannot emit socket: User not found for Order ${order._id}`);
      return;
    }

    const io = getIO();
    if (!order) return;

    // Gửi vào Room riêng của User
    // Event name chung là 'user_event' hoặc cụ thể 'order_update'
    io.to(`user-${profile.user}`).emit('order_update', {
      type: 'ORDER_UPDATE', // Loại sự kiện để FE phân loại
      payload: order, // Dữ liệu mới nhất
    });

    logger.info(`Socket sent to user-${order.profile}: Order ${order.orderId} updated`);
  } catch (error) {
    logger.error('Socket Emit Error:', error.message);
  }
};

module.exports = {
  emitOrderUpdate,
  // ... các hàm khác
};
