const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, customerService, employeeService, tokenService, emailService } = require('../services');
const { getEffectivePermissions } = require('../utils/permission');
const config = require('../config/config');

const register = catchAsync(async (req, res) => {
  // 1. Xác định subdomain
  // Giả sử req.hostname là 'admin.yourdomain.com' hoặc 'app.yourdomain.com'
  const parts = req.hostname.split('.');
  const subdomain = parts[0];

  // (Cách khác): Nếu bạn có một middleware riêng để xử lý subdomain:
  // const subdomain = req.subdomain;

  const user = await authService.register(subdomain, req.body);

  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);

  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.CREATED).send({ user, tokens });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.login(email, password);

  // --- LOGIC MỚI: KIỂM TRA SUBDOMAIN VÀ ROLE ---
  const { hostname } = req;

  // 2. Kiểm tra xem đây có phải là subdomain 'admin' không
  const isAdminSubdomain = hostname.startsWith('admin') || hostname.startsWith('web-admin-sandy');

  // 3. Kiểm tra điều kiện: (Role là 'customer' HOẶC role là 'user') VÀ đang ở trang admin
  const isForbidden = user.role === 'customer' && isAdminSubdomain;

  if (isForbidden) {
    // 4. Trả về 403 Forbidden. KHÔNG tạo token, KHÔNG set cookie.
    return res.status(403).send({
      message: 'Tài khoản của bạn không có quyền truy cập vào trang quản trị.',
    });
  }

  // Nếu qua được kiểm tra, mới tiếp tục tạo token và set cookie
  const tokens = await tokenService.generateAuthTokens(user);

  const permissions = await getEffectivePermissions(user);

  const isProduction = config.env === 'production';

  res.cookie('accessToken', tokens.access.token, {
    httpOnly: true,
    secure: isProduction, // Chỉ bật khi production
    sameSite: isProduction ? 'none' : 'lax', // 'none' khi có cross-site (production)
    maxAge: 30 * 60 * 1000, // 30 phút
    path: '/', // Mặc định gửi mọi request
  });

  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  });

  let me;
  if (user.role === 'customer') {
    me = await customerService.findOne({ user: user.id || user._id });
  } else {
    me = await employeeService.findOne({ user: user.id || user._id });
  }

  // Gửi về thông tin user và permissions.
  res.send({ user, me, permissions, tokens });
});

const logout = catchAsync(async (req, res) => {
  if (req.body.refreshToken) {
    await authService.logout(req.body.refreshToken);
  }

  const isProduction = config.env === 'production';

  // 🔹 Xóa accessToken
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/', // phải giống lúc set
  });

  // 🔹 Xóa refreshToken
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth/refresh', // phải giống lúc set
  });

  res.status(httpStatus.OK).send({ status: true });
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  res.status(httpStatus.NO_CONTENT).send();
});

const getMe = catchAsync(async (req, res) => {
  const { user } = req;

  let me;
  if (user.role === 'customer') {
    me = await customerService.findOne({ user: user.id || user._id });
  } else {
    me = await employeeService.findOne({ user: user.id || user._id });
  }

  const permissions = await getEffectivePermissions(user);

  res.status(httpStatus.OK).send({
    user,
    me,
    permissions,
  });
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  getMe,
};
