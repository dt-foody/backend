const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const config = require('../config/config');
const logger = require('../config/logger');
const { User } = require('../models/index');

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
  const resetPasswordUrl = `https://luuchi.com.vn/vi/forgot-password?token=${token}`;

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

  if (to) {
    const user = await User.findOne({ email: to }).populate('profile');

    if (user) {
      payload.fullName = user.profile?.name;
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
  const verificationEmailUrl = `https://luuchi.com.vn/vi/verify-email?token=${token}`;
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

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
