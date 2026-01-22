const httpStatus = require('http-status');
const crypto = require('crypto');
const tokenService = require('./token.service');
const userService = require('./user.service');
const customerService = require('./customer.service');
const employeeService = require('./employee.service');
const { Token } = require('../models');
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
  // 1. Check email tồn tại (giữ logic cũ)
  const isExist = await userService.findOne({ email: userBody.email }, { lean: true });
  if (isExist) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email đã được sử dụng');
  }

  const { email, phone, password, referralCode } = userBody;

  const isAdmin = subdomain === 'admin';
  const role = isAdmin ? 'admin' : 'customer';

  // 2. Validate referral TRƯỚC (giống code cũ)
  let referredByCustomer = null;

  if (!isAdmin && referralCode && referralCode.trim()) {
    referredByCustomer = await customerService.findOne(
      {
        referralCode: referralCode.trim().toUpperCase(),
        isDeleted: { $ne: true },
      },
      { lean: true }
    );

    if (!referredByCustomer) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Mã giới thiệu không hợp lệ');
    }
  }

  let newUser;

  try {
    // 3. Tạo User (KHÔNG profile, KHÔNG referral)
    newUser = await userService.create({
      email,
      phone,
      password,
      role,
      isEmailVerified: false,
      isActive: true,
    });

    // 4. Chuẩn bị data profile
    const dataProfile = {
      ...userBody,
      user: newUser._id,
    };

    if (email) {
      dataProfile.emails = [{ type: 'Other', value: email, isPrimary: true }];
    }
    if (phone) {
      dataProfile.phones = [{ type: 'Other', value: phone, isPrimary: true }];
    }

    // 5. Tạo profile theo role
    if (isAdmin) {
      await employeeService.create(dataProfile);
    } else {
      const myReferralCode = await generateUniqueReferralCode(email);

      await customerService.create({
        ...dataProfile,
        referralCode: myReferralCode,
        referredBy: referredByCustomer ? referredByCustomer._id : null,
      });
    }
  } catch (error) {
    // Rollback user nếu có lỗi profile
    if (newUser?._id) {
      await userService.deleteHardById(newUser._id);
    }

    if (error instanceof ApiError) throw error;
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Không thể đăng ký: ${error.message}`);
  }

  return newUser;
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

    await userService.updateById(user.id || user._id, { password: newPassword });
    await Token.deleteMany({ user: user.id || user._id, type: tokenTypes.RESET_PASSWORD });
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
