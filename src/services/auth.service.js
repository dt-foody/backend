const httpStatus = require('http-status');
const crypto = require('crypto');
const tokenService = require('./token.service');
const userService = require('./user.service');
const customerService = require('./customer.service');
const employeeService = require('./employee.service');
const { Token, Customer, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Tạo mã giới thiệu duy nhất dựa trên email và random bytes
 */
const generateUniqueReferralCode = async (email) => {
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  const emailHash = crypto.createHash('md5').update(email).digest('hex').substring(0, 4).toUpperCase();

  return `${randomPart}${emailHash}`;
};

/**
 * Đăng ký tài khoản mới
 * @param {string} subdomain
 * @param {object} userBody
 * @returns {Promise<User>}
 */
const register = async (subdomain, userBody) => {
  // 1. Kiểm tra Email tồn tại (giữ nguyên logic cũ)
  // Lưu ý: userService.isEmailTaken là function trong user.model static,
  // nhưng nếu bạn dùng userService.findOne như code cũ thì dùng logic dưới đây:
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email đã được sử dụng');
  }

  // Tách referralCode ra để xử lý riêng
  const { referralCode: inputReferralCode, ...userData } = userBody;

  const isAdmin = subdomain === 'admin';
  const role = isAdmin ? 'admin' : 'customer';

  // 2. Tạo User (Chỉ chứa thông tin xác thực, KHÔNG chứa referral)
  const user = await userService.create({
    email: userData.email,
    password: userData.password,
    phone: userData.phone,
    role,
    isEmailVerified: false,
    isActive: true,
  });

  // 3. Tạo Profile tương ứng

  const dataProfile = {
    ...userBody,
    user: user._id,
  };

  // Chuẩn hóa mảng emails/phones (giữ nguyên logic của bạn)
  if (userBody.email) {
    dataProfile.emails = [{ type: 'Other', value: userBody.email, isPrimary: true }];
  }
  if (userBody.phone) {
    dataProfile.phones = [{ type: 'Other', value: userBody.phone, isPrimary: true }];
  }

  if (isAdmin) {
    await employeeService.create(dataProfile);
  } else {
    // --- LOGIC REFERRAL SYSTEM (CHỈ DÀNH CHO CUSTOMER) ---

    let referredByCustomerId = null;

    // A. Xử lý mã người giới thiệu (nếu có)
    if (inputReferralCode && inputReferralCode.trim()) {
      // Tìm Customer sở hữu mã này (Tìm trong Customer, KHÔNG phải User)
      const referrer = await Customer.findOne({
        referralCode: inputReferralCode.trim().toUpperCase(),
        isDeleted: { $ne: true },
      });

      if (referrer) {
        // Kiểm tra logic tự giới thiệu bản thân (nếu cần thiết, dù user mới chưa có code)
        // Với user mới tinh thì không sợ trùng code cũ, nhưng check cho chắc
        referredByCustomerId = referrer.id;
      } else {
        // Tùy chọn: Báo lỗi nếu mã sai HOẶC lờ đi.
        // Thường thì nên báo lỗi để user biết mã sai.
        throw new ApiError(httpStatus.BAD_REQUEST, 'Mã giới thiệu không hợp lệ');
      }
    }

    // B. Tạo mã giới thiệu mới cho khách hàng này
    const newMyReferralCode = await generateUniqueReferralCode(userData.email);

    // C. Tạo Customer Profile
    await customerService.create({
      ...dataProfile,

      // Các trường Referral mới
      referralCode: newMyReferralCode, // Mã của chính họ
      referredBy: referredByCustomerId, // ID của Customer giới thiệu (nếu có)
    });
  }

  return user;
};

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const login = async (username, password) => {
  const user = await userService.findOne({
    $or: [{ email: username }, { phone: username }],
  });
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email hoặc mật khẩu không chính xác');
  }
  return user;
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.remove();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH);
    const user = await userService.findById(refreshTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await refreshTokenDoc.remove();
    return tokenService.generateAuthTokens(user);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const user = await userService.findById(resetPasswordTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await userService.updateById(user.id, { password: newPassword });
    await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise}
 */
const verifyEmail = async (verifyEmailToken) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);

    const user = await userService.findById(verifyEmailTokenDoc.user);
    if (!user) {
      throw new Error();
    }

    // await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
    await userService.updateOne({ _id: user._id || user.id }, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
};
