const express = require('express');
const { auth } = require('../../middlewares/auth');
const notificationController = require('../../controllers/notification.controller');
const queryMiddleware = require('../../middlewares/queryMiddleware');

// Import validation nếu cần thiết (ở đây làm đơn giản)
// const notificationValidation = require('../../validations/notification.validation');

const router = express.Router();

// Tất cả các route này đều cần đăng nhập
router.use(auth());

// router.route('/').get(notificationController.getNotifications); // GET /v1/notifications

router.get('/', queryMiddleware, notificationController.getNotifications);

router.route('/unread-count').get(notificationController.getUnreadCount); // GET /v1/notifications/unread-count

router.route('/read-all').patch(notificationController.markAllAsRead); // PATCH /v1/notifications/read-all

router.route('/:notificationId/read').patch(notificationController.markAsRead); // PATCH /v1/notifications/:id/read

module.exports = router;
