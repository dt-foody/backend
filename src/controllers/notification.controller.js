const httpStatus = require('http-status');
const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { notificationService } = require('../services');

/**
 * Lấy lịch sử thông báo của User đang đăng nhập
 */
const getNotifications = catchAsync(async (req, res) => {
  // Lấy các tham số phân trang (page, limit)
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  // Mặc định sort mới nhất trước
  if (!options.sortBy) {
    options.sortBy = 'createdAt:desc';
  }

  // Gọi service lấy danh sách (truyền user đang login để lọc)
  const result = await notificationService.queryNotifications(req.user, options);

  res.send(result);
});

/**
 * Đánh dấu 1 thông báo là đã đọc
 */
const markAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;
  const notification = await notificationService.markAsRead(notificationId, req.user._id);
  res.send(notification);
});

/**
 * Đánh dấu TẤT CẢ thông báo là đã đọc
 */
const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user._id);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Lấy số lượng thông báo chưa đọc (Dùng để hiện badge đỏ trên chuông)
 */
const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.countUnread(req.user._id);
  res.send({ unreadCount: count });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
