const httpStatus = require('http-status');
const tokenService = require('./token.service');
const userService = require('./user.service');
const customerService = require('./customer.service');
const employeeService = require('./employee.service');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Đăng ký tài khoản mới dựa trên subdomain.
 * Tạo User và (Customer hoặc Employee) tương ứng.
 * @param {string} subdomain - Lấy từ request (ví dụ: 'admin' hoặc 'app')
 * @param {object} userBody - Dữ liệu từ form (chứa email, password, name, phone, ...)
 * @returns {Promise<User>} Đối tượng User vừa được tạo
 */
const register = async (subdomain, userBody) => {
  // 1. Check email exist (giữ nguyên)
  const isExist = await userService.findOne({ email: userBody.email }, { lean: true });
  if (isExist) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email đã được sử dụng');
  }

  const { email, phone, password } = userBody;
  const isAdmin = subdomain === 'admin';
  const role = isAdmin ? 'admin' : 'customer';

  let newUser;

  try {
    // 2. Tạo User trước
    newUser = await userService.create({
      email,
      phone,
      password,
      role,
      isEmailVerified: false,
      profileType: isAdmin ? 'Employee' : 'Customer', // Định nghĩa type trước
      // profile: chưa có ID, để null hoặc update sau (do đã bỏ required: true)
    });

    // 3. Chuẩn bị data cho Profile
    // QUAN TRỌNG: Phải gán User ID vào đây
    const dataProfile = {
      ...userBody,
      user: newUser._id,
    };

    // Chuẩn hóa mảng emails/phones (giữ nguyên logic của bạn)
    if (userBody.email) {
      dataProfile.emails = [{ type: 'Other', value: userBody.email, isPrimary: true }];
    }
    if (userBody.phone) {
      dataProfile.phones = [{ type: 'Other', value: userBody.phone, isPrimary: true }];
    }

    // 4. Tạo Profile
    try {
      let profileDoc;
      if (isAdmin) {
        // Gọi create của base service (hoặc sửa lại create của EmployeeService để đơn giản hơn)
        // Lưu ý: dataProfile đã có field 'user', nên Employee sẽ lưu được ref
        profileDoc = await employeeService.create(dataProfile);
      } else {
        profileDoc = await customerService.create(dataProfile);
      }

      // 5. Update ngược lại User để link profile
      newUser.profile = profileDoc._id;
      await newUser.save(); // Lưu lại user với profile id
    } catch (profileError) {
      // Rollback: Xóa user nếu tạo profile lỗi
      await userService.deleteHardById(newUser._id); // Đảm bảo hàm này tồn tại hoặc dùng User.findByIdAndDelete
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Không thể tạo hồ sơ: ${profileError.message}`);
    }
  } catch (error) {
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
const login = async (email, password) => {
  const user = await userService.findOne({ email });
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
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
