/* eslint-disable no-await-in-loop */
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const config = require('../config/config');
const logger = require('../config/logger');
const { User, Customer, Employee } = require('../models/index');

const { emailUrls } = config;

const transport = nodemailer.createTransport(config.email.smtp);

/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));
}

/**
 * Hàm helper: Đọc file, đăng ký partials và compile template
 * @param {string} templateName - Tên file template (vd: verification.hbs)
 * @param {object} data - Dữ liệu cần bind vào template
 * @returns {Promise<string>} - HTML string hoàn chỉnh
 */
const getTemplate = async (templateName, data) => {
  try {
    const templateDir = path.join(__dirname, '../templates/');
    const partialsDir = path.join(templateDir, 'partials');

    // 1. Đọc song song các file cần thiết (Layout, Header, Footer, và Template chính)
    const [layoutSource, headerSource, footerSource, templateSource] = await Promise.all([
      fs.promises.readFile(path.join(partialsDir, 'layout.hbs'), 'utf8'),
      fs.promises.readFile(path.join(partialsDir, 'header.hbs'), 'utf8'),
      fs.promises.readFile(path.join(partialsDir, 'footer.hbs'), 'utf8'),
      fs.promises.readFile(path.join(templateDir, templateName), 'utf8'),
    ]);

    // 2. Đăng ký Partials (Header & Footer) để Handlebars hiểu
    handlebars.registerPartial('header', headerSource);
    handlebars.registerPartial('footer', footerSource);

    // 3. Compile Content (Nội dung chính) trước
    const contentTemplate = handlebars.compile(templateSource);
    const htmlBody = contentTemplate(data);

    // 4. Compile Layout và nhét Content vào biến {{{body}}}
    const layoutTemplate = handlebars.compile(layoutSource);

    // Trả về HTML hoàn chỉnh: Layout bao bọc Content
    return layoutTemplate({
      ...data, // Truyền dữ liệu (title, subtitle...) xuống layout/header
      body: htmlBody, // Truyền nội dung chính vào layout
    });
  } catch (error) {
    logger.error(`Error processing email template ${templateName}:`, error);
    throw new Error('Could not render email template');
  }
};

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text, html) => {
  const msg = {
    from: config.email.from,
    to,
    subject,
    text,
    html,
  };
  await transport.sendMail(msg);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = 'Hỗ trợ đặt lại mật khẩu cho tài khoản Lưu Chi';
  const resetPasswordUrl = `${emailUrls.resetPassword}${token}`;

  const payload = {
    // Header
    title: 'Yêu cầu đặt lại mật khẩu',

    // Body
    fullName: '', // nếu cần lấy từ database thì truyền từ ngoài
    userEmail: to,
    resetPasswordUrl,

    // Thời gian hiển thị thân thiện (optional)
    expirationText: `${config.jwt.resetPasswordExpirationMinutes} phút`,
  };

  let profile = null;

  if (to) {
    const user = await User.findOne({ email: to });
    if (user) {
      profile = (await Customer.findOne({ user: user._id })) || (await Employee.findOne({ user: user._id }));
    }

    if (profile) {
      payload.fullName = profile?.name;
    }
  }

  const html = await getTemplate('reset-password.hbs', payload);

  await sendEmail(to, subject, null, html);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (profileName, to, token) => {
  const subject = 'Lưu Chi gửi bạn món quà chào mừng đầu tiên!';
  const verificationEmailUrl = `${emailUrls.verifyEmail}${token}`;
  // const userName = to.split('@')[0]; // Lấy tên từ email nếu chưa có tên thật

  // Đọc file src/templates/email/verification.hbs
  const html = await getTemplate('verification.hbs', {
    // Dữ liệu cho Header
    title: 'Chào mừng đến với cộng đồng Lưu Chi',
    subtitle: 'Tài khoản của bạn đã được tạo thành công!',

    // Dữ liệu cho nội dung chính
    profileName,
    userEmail: to,
    verificationEmailUrl,
    createdDate: new Date().toLocaleDateString('vi-VN'),
  });

  await sendEmail(to, subject, null, html);
};

const calculateDaysSinceRegistration = (createdAt) => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const sendReferralReminderEmail = async (user) => {
  const subject = 'Chia sẻ “gu” của bạn – Lưu Chi gửi quà tri ân!';
  const referralProgramUrl = `https://luuchi.com.vn/vi/`;

  const payload = {
    title: 'Chương trình giới thiệu bạn bè',
    profileName: user.profile?.name || 'Bạn',
    userEmail: user.email,
    referralCode: user.referralCode,
    referralProgramUrl,
    registeredDays: calculateDaysSinceRegistration(user.createdAt),
  };

  const html = await getTemplate('referral-reminder.hbs', payload);

  await sendEmail(user.email, subject, null, html);
};

const sendReferralRemindersToEligibleUsers = async () => {
  // eslint-disable-next-line no-useless-catch
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 10);

    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Tìm user:
    // 1. Đăng ký cách đây 10 ngày
    // 2. Chưa gửi thành công (isSent != true)
    // 3. Số lần thử chưa vượt quá giới hạn (ví dụ: tối đa 3 lần thử)
    const eligibleUsers = await Customer.find({
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      'referralReminder.isSent': { $ne: true },
      'referralReminder.sendCount': { $lt: 3 }, // [Optional] Chỉ retry tối đa 3 lần
    });

    if (eligibleUsers.length === 0) {
      return { success: true, sent: 0, failed: 0, total: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const user of eligibleUsers) {
      try {
        // Tăng số lần thử lên 1 trước (hoặc sau khi gửi đều được, ở đây ta cập nhật DB sau)
        await sendReferralReminderEmail(user);

        // --- THÀNH CÔNG ---
        await Customer.updateOne(
          { _id: user._id },
          {
            $set: {
              'referralReminder.isSent': true,
              'referralReminder.sentAt': new Date(),
              'referralReminder.error': null,
            },
            $inc: { 'referralReminder.sendCount': 1 }, // Tăng 1 lần gửi
          }
        );

        sentCount += 1;
        // logger.info...

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        failedCount += 1;

        logger.error(`Failed to send referral reminder email to ${user.email}:`, error);

        // --- THẤT BẠI ---
        await Customer.updateOne(
          { _id: user._id },
          {
            $set: {
              'referralReminder.error': error.message,
              // isSent vẫn là false để lần sau job chạy lại sẽ quét thấy
            },
            $inc: { 'referralReminder.sendCount': 1 }, // Vẫn tăng 1 lần thử dù lỗi
          }
        );
      }
    }

    return {
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: eligibleUsers.length,
    };
  } catch (error) {
    logger.error('Error in sendReferralRemindersToEligibleUsers:', error);
    return null;
  }
};

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
  sendReferralRemindersToEligibleUsers,
};
