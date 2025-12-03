// fileName: src/services/email.service.js
const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../config/logger');

const transport = nodemailer.createTransport(config.email.smtp);
/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));
}

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
    text, // có thể null nếu dùng html
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
  const subject = 'Đặt lại mật khẩu — Lưu Chi Coffee';
  const resetPasswordUrl = `https://luuchi.com.vn/en/forgot-password?token=${token}`;
  const userEmail = to;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f7fa;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          
          <tr>
            <td style="background:linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);padding:40px 32px;text-align:center;">
              <div style="background:#fff;width:80px;height:80px;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(0,0,0,0.15);">
                <span style="font-size:40px;">🔐</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                Yêu cầu đặt lại mật khẩu
              </h1>
              <p style="margin:12px 0 0;color:#ffffff;font-size:16px;opacity:0.95;">
                Chúng tôi nhận được yêu cầu thay đổi mật khẩu từ bạn
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 24px;color:#2c3e50;font-size:16px;line-height:1.6;">
                Xin chào,
              </p>
              
              <p style="margin:0 0 24px;color:#546e7a;font-size:15px;line-height:1.7;">
                Có vẻ như bạn đã quên mật khẩu cho tài khoản <strong>${userEmail}</strong> tại Lưu Chi. 
                Đừng lo lắng, bạn có thể thiết lập lại mật khẩu mới bằng cách nhấn vào nút bên dưới.
              </p>

              <table role="presentation" style="width:100%;margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetPasswordUrl}" 
                       style="display:inline-block;background:linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);color:#ffffff;
                              padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:600;
                              font-size:16px;box-shadow:0 4px 12px rgba(255,107,53,0.3);
                              transition:all 0.3s ease;">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width:100%;border-collapse:collapse;background:#fff3e0;border-radius:12px;margin:24px 0;">
                <tr>
                  <td style="padding:20px;">
                    <div style="display:flex;align-items:flex-start;">
                      <span style="font-size:20px;margin-right:12px;">⚠️</span>
                      <div>
                        <p style="margin:0 0 8px;color:#e65100;font-size:14px;font-weight:700;">
                          Bạn không yêu cầu thay đổi?
                        </p>
                        <p style="margin:0;color:#ef6c00;font-size:13px;line-height:1.5;">
                          Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email. Mật khẩu của bạn sẽ không thay đổi và tài khoản của bạn vẫn an toàn.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="margin:24px 0 0;color:#78909c;font-size:14px;line-height:1.6;">
                Link đặt lại mật khẩu này chỉ có hiệu lực trong vòng ${config.jwt.resetPasswordExpirationMinutes} phút.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background:#f8f9fa;padding:32px;text-align:center;border-top:1px solid #e9ecef;">
              <p style="margin:0 0 16px;color:#2c3e50;font-size:15px;font-weight:600;">
                Trân trọng,<br>
                <span style="color:#FF6B35;">Đội ngũ Lưu Chi</span>
              </p>
              
              <div style="margin:20px 0;padding-top:20px;border-top:1px solid #dee2e6;">
                <p style="margin:0 0 8px;color:#78909c;font-size:12px;">
                  © 2025 Lưu Chi
                </p>
                <p style="margin:0;color:#90a4ae;font-size:11px;line-height:1.6;">
                  Đây là email tự động, vui lòng không trả lời email này.<br>
                  Nếu cần hỗ trợ, liên hệ: <a href="mailto:support@foody.vn" style="color:#FF6B35;text-decoration:none;">support@foody.vn</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  await sendEmail(to, subject, null, html);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  const subject = 'Xác minh địa chỉ email của bạn — Lưu Chi Coffee';
  const verificationEmailUrl = `https://luuchi.com.vn/en/verify-email?token=${token}`;
  const userName = to;
  const userEmail = to;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f7fa;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          
          <tr>
            <td style="background:linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);padding:40px 32px;text-align:center;">
              <div style="background:#fff;width:80px;height:80px;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(0,0,0,0.15);">
                <span style="font-size:40px;">🍜</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                Chào mừng đến với Lưu Chi!
              </h1>
              <p style="margin:12px 0 0;color:#ffffff;font-size:16px;opacity:0.95;">
                Tài khoản của bạn đã được tạo thành công
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 24px;color:#2c3e50;font-size:16px;line-height:1.6;">
                Xin chào <strong>${userName || 'bạn'}</strong>,
              </p>
              
              <p style="margin:0 0 24px;color:#546e7a;font-size:15px;line-height:1.7;">
                Cảm ơn bạn đã đăng ký tài khoản tại <strong style="color:#FF6B35;">Lưu Chi</strong>! 
                Chúng tôi rất vui mừng được đồng hành cùng bạn trong hành trình khám phá ẩm thực.
              </p>

              <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:12px;margin:24px 0;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 16px;color:#37474f;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                      Thông tin tài khoản
                    </p>
                    <table role="presentation" style="width:100%;">
                      <tr>
                        <td style="padding:8px 0;color:#607d8b;font-size:14px;width:35%;">Email:</td>
                        <td style="padding:8px 0;color:#2c3e50;font-size:14px;font-weight:600;">${userEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#607d8b;font-size:14px;">Ngày tạo:</td>
                        <td style="padding:8px 0;color:#2c3e50;font-size:14px;font-weight:600;">${new Date().toLocaleDateString(
                          'vi-VN'
                        )}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0;color:#546e7a;font-size:15px;line-height:1.7;">
                Để bắt đầu sử dụng, vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào nút bên dưới:
              </p>

              <table role="presentation" style="width:100%;margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationEmailUrl}" 
                       style="display:inline-block;background:linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);color:#ffffff;
                              padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:600;
                              font-size:16px;box-shadow:0 4px 12px rgba(255,107,53,0.3);
                              transition:all 0.3s ease;">
                      Xác thực Email
                    </a>
                  </td>
                </tr>
              </table>

              <div style="margin:32px 0;">
                <h3 style="margin:0 0 20px;color:#2c3e50;font-size:18px;font-weight:700;">
                  Khám phá với Lưu Chi
                </h3>
                <table role="presentation" style="width:100%;">
                  <tr>
                    <td style="padding:12px 0;vertical-align:top;width:50%;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="font-size:24px;margin-right:12px;">🔍</span>
                        <div>
                          <strong style="color:#2c3e50;font-size:14px;display:block;margin-bottom:4px;">Tìm kiếm món ăn</strong>
                          <span style="color:#78909c;font-size:13px;">Hàng nghìn món ngon</span>
                        </div>
                      </div>
                    </td>
                    <td style="padding:12px 0;vertical-align:top;width:50%;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="font-size:24px;margin-right:12px;">⭐</span>
                        <div>
                          <strong style="color:#2c3e50;font-size:14px;display:block;margin-bottom:4px;">Đánh giá thực tế</strong>
                          <span style="color:#78909c;font-size:13px;">Review chân thật</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;vertical-align:top;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="font-size:24px;margin-right:12px;">🚀</span>
                        <div>
                          <strong style="color:#2c3e50;font-size:14px;display:block;margin-bottom:4px;">Đặt món nhanh</strong>
                          <span style="color:#78909c;font-size:13px;">Giao hàng tận nơi</span>
                        </div>
                      </div>
                    </td>
                    <td style="padding:12px 0;vertical-align:top;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="font-size:24px;margin-right:12px;">🎁</span>
                        <div>
                          <strong style="color:#2c3e50;font-size:14px;display:block;margin-bottom:4px;">Ưu đãi độc quyền</strong>
                          <span style="color:#78909c;font-size:13px;">Khuyến mãi hấp dẫn</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin:24px 0 0;color:#78909c;font-size:14px;line-height:1.6;">
                Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này hoặc 
                <a href="mailto:support@foody.vn" style="color:#FF6B35;text-decoration:none;font-weight:600;">liên hệ với chúng tôi</a>.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background:#f8f9fa;padding:32px;text-align:center;border-top:1px solid #e9ecef;">
              <p style="margin:0 0 16px;color:#2c3e50;font-size:15px;font-weight:600;">
                Trân trọng,<br>
                <span style="color:#FF6B35;margin-top:4px;">Đội ngũ Lưu Chi</span>
              </p>
              
              <div style="margin:24px 0;">
                <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;">
                  <span style="display:inline-block;width:36px;height:36px;background:#4267B2;border-radius:50%;
                               line-height:36px;color:#fff;font-size:18px;">f</span>
                </a>
                <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;">
                  <span style="display:inline-block;width:36px;height:36px;background:#E1306C;border-radius:50%;
                               line-height:36px;color:#fff;font-size:18px;">📷</span>
                </a>
                <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;">
                  <span style="display:inline-block;width:36px;height:36px;background:#25D366;border-radius:50%;
                               line-height:36px;color:#fff;font-size:18px;">📱</span>
                </a>
              </div>

              <div style="margin:20px 0;padding-top:20px;border-top:1px solid #dee2e6;">
                <p style="margin:0 0 8px;color:#78909c;font-size:12px;">
                  © 2025 Lưu Chi
                </p>
                <p style="margin:0;color:#90a4ae;font-size:11px;line-height:1.6;">
                  Đây là email tự động, vui lòng không trả lời email này.<br>
                  Nếu cần hỗ trợ, liên hệ: <a href="mailto:support@foody.vn" style="color:#FF6B35;text-decoration:none;">support@foody.vn</a>
                </p>
              </div>

              <div style="margin-top:16px;">
                <a href="#" style="color:#90a4ae;text-decoration:none;font-size:12px;margin:0 8px;">Điều khoản</a>
                <span style="color:#cfd8dc;">|</span>
                <a href="#" style="color:#90a4ae;text-decoration:none;font-size:12px;margin:0 8px;">Chính sách</a>
                <span style="color:#cfd8dc;">|</span>
                <a href="#" style="color:#90a4ae;text-decoration:none;font-size:12px;margin:0 8px;">Trợ giúp</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  await sendEmail(to, subject, null, html);
};

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
