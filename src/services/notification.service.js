const { Notification } = require('../models');
const { emitNotification } = require('../utils/socket.util');

/**
 * Tạo thông báo mới (Code cũ giữ nguyên)
 */
const createNotification = async (data) => {
  const notification = await Notification.create({
    title: data.title,
    content: data.content,
    type: data.type || 'ORDER_NEW',
    referenceId: data.referenceId,
    referenceModel: data.referenceModel || 'Order',
    isGlobal: data.isGlobal || false,
    receivers: data.receivers || [],
    readBy: [],
  });

  await emitNotification(notification, data.receivers);
  return notification;
};

/**
 * Lấy danh sách thông báo cho User (Hỗ trợ phân trang)
 * @param {Object} user - User object từ req.user
 * @param {Object} options - { page, limit, sortBy }
 */
const queryNotifications = async (user, options) => {
  const userId = user._id;

  // 1. Điều kiện lọc:
  // - Hoặc là thông báo Global (isGlobal = true)
  // - Hoặc là thông báo gửi đích danh cho User (receivers chứa userId)
  const filter = {
    $or: [{ isGlobal: true }, { receivers: userId }],
  };

  // 2. Query DB với phân trang
  // Sử dụng plugin paginate của bạn
  const result = await Notification.paginate(filter, options);

  // 3. Xử lý dữ liệu trả về (Custom Transform)
  // Mongoose paginate trả về: { results: [], page, limit, ... }
  // Chúng ta cần map lại results để thêm field "isRead" cho từng item
  const mappedResults = result.results.map((notif) => {
    const notifObj = notif.toObject();

    // Kiểm tra xem userId có nằm trong mảng readBy không
    const isRead = notif.readBy && notif.readBy.some((r) => r.user.toString() === userId.toString());

    // Xóa field readBy đi cho nhẹ response (không cần thiết gửi danh sách người đã đọc về client)
    delete notifObj.readBy;
    delete notifObj.receivers;

    return {
      ...notifObj,
      isRead, // true/false
    };
  });

  return { ...result, results: mappedResults };
};

/**
 * Đánh dấu 1 thông báo đã đọc
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw new Error('Thông báo không tồn tại');

  const alreadyRead = notification.readBy.some((r) => r.user.toString() === userId.toString());
  if (!alreadyRead) {
    notification.readBy.push({ user: userId, readAt: new Date() });
    await notification.save();
  }
  return notification;
};

/**
 * Đánh dấu TẤT CẢ là đã đọc
 */
const markAllAsRead = async (userId) => {
  // Tìm tất cả thông báo của user mà chưa có userId trong readBy
  const filter = {
    $or: [{ isGlobal: true }, { receivers: userId }],
    'readBy.user': { $ne: userId }, // Chỉ tìm những cái chưa đọc
  };

  // UpdateMany: push user vào mảng readBy
  await Notification.updateMany(filter, {
    $push: {
      readBy: { user: userId, readAt: new Date() },
    },
  });
};

/**
 * Đếm số lượng chưa đọc
 */
const countUnread = async (userId) => {
  const filter = {
    $or: [{ isGlobal: true }, { receivers: userId }],
    'readBy.user': { $ne: userId },
  };
  return Notification.countDocuments(filter);
};

module.exports = {
  createNotification,
  queryNotifications,
  markAsRead,
  markAllAsRead,
  countUnread,
};
