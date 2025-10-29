const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, userService, tokenService, emailService } = require('../services');
const { getEffectivePermissions } = require('../utils/permission');

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

  // 1. Lấy hostname từ request (ví dụ: 'admin.domain.com' hoặc 'localhost')
  // req.hostname sẽ tự động bỏ port (ví dụ :3000)
  const hostname = req.hostname;

  // 2. Kiểm tra xem đây có phải là subdomain 'admin' không
  // Dùng startsWith để hoạt động cho cả 'admin.localhost' và 'admin.yourdomain.com'
  const isAdminSubdomain = hostname.startsWith('admin');

  // 3. Kiểm tra điều kiện: (Role là 'customer' HOẶC role là 'user') VÀ đang ở trang admin
  // (Tôi giả sử role là 'customer' hoặc 'user', bạn hãy điều chỉnh cho đúng)
  const isForbidden = (user.role === 'customer') && isAdminSubdomain;

  if (isForbidden) {
    // 4. Trả về 403 Forbidden. KHÔNG tạo token, KHÔNG set cookie.
    return res.status(403).send({
      message: 'Tài khoản của bạn không có quyền truy cập vào trang quản trị.',
    });
  }
  
  // --- KẾT THÚC LOGIC MỚI ---

  // Nếu qua được kiểm tra, mới tiếp tục tạo token và set cookie
  const tokens = await tokenService.generateAuthTokens(user);

  const permissions = await getEffectivePermissions(user);

  res.cookie('accessToken', tokens.access.token, {
    httpOnly: true,
    secure: true, // Chỉ gửi qua HTTPS
    sameSite: 'strict', // Chống tấn công CSRF
    maxAge: 1800000 // 30 phút (nên dùng 1800000 cho 30 phút)
  });

  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh', // Chỉ gửi cookie này đến đúng endpoint refresh
    maxAge: 604800000 // 7 ngày
  });

  // Gửi về thông tin user và permissions. 
  // KHÔNG nên gửi 'tokens' về client vì đã dùng HttpOnly cookie.
  res.send({ user, permissions, tokens }); 
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
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
  const permissions = await getEffectivePermissions(user);

  res.status(httpStatus.OK).send({
    ...user.toJSON(),
    permissions
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
