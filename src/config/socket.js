const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie'); // Thư viện giúp parse cookie string thành object
const config = require('./config');
const logger = require('./logger');

let io = null;

/**
 * Khởi tạo Socket.io Server
 * @param {Object} httpServer - Server HTTP của Node.js
 */
const initSocket = (httpServer) => {
  io = socketIo(httpServer, {
    cors: {
      // Trong môi trường Production, hãy thay '*' bằng domain frontend của bạn
      // Ví dụ: origin: "https://your-foody-app.com"
      origin: config.env === 'production' ? config.clientUrl : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // --- MIDDLEWARE: XÁC THỰC NGƯỜI DÙNG ---
  io.use((socket, next) => {
    try {
      let token = null;

      // 1. Ưu tiên lấy token từ 'auth' handshake (Dành cho Mobile App hoặc Client tự gửi)
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      // 2. Nếu không có, tìm trong Cookie header (Dành cho Web Browser - HttpOnly)
      if (!token && socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        // Thay 'accessToken' bằng tên key cookie thực tế bạn đang lưu
        token = cookies.accessToken || cookies.token;
      }

      // 3. Nếu tìm thấy Token -> Verify
      if (token) {
        const payload = jwt.verify(token, config.jwt.secret);
        // eslint-disable-next-line no-param-reassign
        socket.userId = payload.sub; // Lưu User ID vào session của socket

        // (Tuỳ chọn) Lưu thêm role nếu cần phân quyền
        // socket.userRole = payload.role;
      }

      // Nếu không có token -> Vẫn cho phép kết nối nhưng là Guest (không có socket.userId)
      next();
    } catch (error) {
      logger.warn(`Socket Auth Error: ${error.message}`);
      // Nếu token sai/hết hạn -> Vẫn cho kết nối nhưng coi như Guest
      // Hoặc nếu muốn chặn tuyệt đối thì dùng: next(new Error('Authentication error'));
      next();
    }
  });

  // --- EVENT: CONNECTION ---
  io.on('connection', (socket) => {
    // 1. Tự động Join vào Room riêng của User (nếu đã đăng nhập)
    if (socket.userId) {
      const userRoom = `user-${socket.userId}`;
      socket.join(userRoom);
      logger.info(`🔌 Socket Authenticated: ${socket.id} joined ${userRoom}`);
    } else {
      logger.debug(`🔌 Socket Guest connected: ${socket.id}`);
    }

    // 2. Client chủ động Join vào Room Đơn hàng (Khi xem chi tiết đơn)
    // Client code: socket.emit('join_order_room', 'order_id_123');
    socket.on('join_order_room', (orderId) => {
      if (!orderId) return;
      const orderRoom = `order-${orderId}`;
      socket.join(orderRoom);
      // logger.debug(`Socket ${socket.id} joined ${orderRoom}`);
    });

    // 3. Client rời Room Đơn hàng
    socket.on('leave_order_room', (orderId) => {
      if (!orderId) return;
      socket.leave(`order-${orderId}`);
    });

    // 4. Xử lý ngắt kết nối
    socket.on('disconnect', () => {
      // logger.debug(`Socket ${socket.id} disconnected`);
    });
  });

  return io;
};

/**
 * Lấy instance IO để sử dụng ở các Service khác (OrderService, NotificationService...)
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
};
