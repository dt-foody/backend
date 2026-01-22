const mongoose = require('mongoose');
const http = require('http');
const cron = require('node-cron');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { sendReferralRemindersToEligibleUsers } = require('./services/email.service');
const { orderService } = require('./services');

const { initSocket } = require('./config/socket');

let server;

// 1. Tạo HTTP Server từ Express App
const httpServer = http.createServer(app);

// 2. Gắn Socket.io vào HTTP Server này
initSocket(httpServer);

mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');

  // --- [SỬA LẠI ĐOẠN NÀY] ---
  // Thay vì app.listen, hãy dùng httpServer.listen
  server = httpServer.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
  // --------------------------

  cron.schedule(
    '0 10 * * *',
    async () => {
      logger.info('[Cron] Starting referral reminder job...');
      try {
        const result = await sendReferralRemindersToEligibleUsers();
        logger.info('[Cron] Referral reminder job completed', result);
      } catch (error) {
        logger.error('[Cron] Referral reminder job failed:', error);
      }
    },
    {
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );

  // Mỗi 1 phút (* * * * *), hệ thống sẽ chạy hàm quét.
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await orderService.scanAndHandlePendingOrders();
      } catch (error) {
        logger.error('[Cron] Order Scan Error:', error);
      }
    },
    {
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
