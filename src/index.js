const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const cron = require('node-cron');
const { sendReferralRemindersToEligibleUsers } = require('./services/email.service');

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });

  cron.schedule('0 10 * * *', async () => {
    logger.info('[Cron] Starting referral reminder job...');
    try {
      const result = await sendReferralRemindersToEligibleUsers();
      logger.info('[Cron] Referral reminder job completed', result);
    } catch (error) {
      logger.error('[Cron] Referral reminder job failed:', error);
    }
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });
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
