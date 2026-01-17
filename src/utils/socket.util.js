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

/**
 * Bắn thông báo realtime cho danh sách user hoặc toàn bộ Admin
 * @param {Object} notification - Document Notification vừa tạo
 * @param {Array} receiverIds - Danh sách ID User nhận (nếu isGlobal = false)
 */
const emitNotification = async (notification, receiverIds = []) => {
  try {
    const io = getIO();
    let targetUserIds = [];

    if (notification.isGlobal) {
      // Nếu applyAll: Tìm tất cả User có role là admin/employee hoặc nằm trong bảng Employee
      // Giả sử logic là tìm tất cả User linked với Employee model hoặc check role
      // Ở đây ví dụ tìm tất cả nhân viên
      const employees = await Employee.find({ isDeleted: false }).select('user');
      targetUserIds = employees.map((e) => e.user.toString());
    } else {
      targetUserIds = receiverIds.map((id) => id.toString());
    }

    // Emit event tới từng Room User
    targetUserIds.forEach((userId) => {
      io.to(`user-${userId}`).emit('notification_received', {
        type: 'NOTIFICATION_NEW',
        payload: notification,
      });
    });

    logger.info(`Notification sent to ${targetUserIds.length} users.`);
  } catch (error) {
    logger.error('Socket Notification Error:', error.message);
  }
};

module.exports = {
  emitOrderUpdate,
  emitNotification,
  // ... các hàm khác
};
