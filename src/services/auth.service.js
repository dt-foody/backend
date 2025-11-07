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
  // 1. Kiểm tra xem email đã được sử dụng chưa
  // (Giả sử userService.createUser sẽ xử lý việc này,
  // hoặc chúng ta có thể gọi User.isEmailTaken nếu service không xử lý)
  const isExist = await userService.findOne({ email: userBody.email }, { lean: true });
  if (isExist) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email đã được sử dụng');
  }

  // Tách riêng email và password cho model User
  const { email, password } = userBody;

  // Xác định vai trò dựa trên subdomain
  const isAdmin = subdomain === 'admin';
  const role = isAdmin ? 'admin' : 'customer';

  // 2. Khai báo ngoài try-catch để có thể return
  let newUser;

  try {
    // 3. TẠO USER (cho logic xác thực)
    // Sử dụng userService.createUser
    newUser = await userService.create({
      email,
      password,
      role,
      isEmailVerified: false, // Mặc định là chưa xác thực
    });

    // 4. TẠO PROFILE (Customer hoặc Employee cho thông tin nghiệp vụ)
    try {
      if (isAdmin) {
        // Nếu là admin, tạo Employee
        // Sử dụng employeeService.createEmployee
        const employee = await employeeService.create({
          ...userBody, // Truyền tất cả thông tin profile (name, phone, gender...)
          user: newUser._id, // Đây là liên kết 1-1 quan trọng
        });

        newUser.profileType = 'Employee';
        newUser.profile = employee._id;
      } else {
        // Nếu là customer, tạo Customer
        // Sử dụng customerService.createCustomer
        const customer = await customerService.create({
          ...userBody, // Truyền tất cả thông tin profile (name, phone, addresses...)
          user: newUser._id, // Đây là liên kết 1-1 quan trọng
        });

        newUser.profileType = 'Customer';
        newUser.profile = customer._id;
      
      }
    } catch (profileError) {
      // 6. ROLLBACK THỦ CÔNG:
      // Nếu tạo Profile thất bại, ta phải xóa User đã tạo
      await userService.deleteHardById(newUser._id);

      // Ném lỗi ban đầu của Profile ra ngoài
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Không thể tạo hồ sơ: ${profileError.message}`);
    }

    // (Tùy chọn: Gửi email xác thực ở đây)
    // await emailService.sendVerificationEmail(newUser.email, verifyToken);
  } catch (error) {
    // 7. Bắt lỗi (từ userService.createUser hoặc từ lỗi rollback)
    if (error instanceof ApiError) {
      throw error; // Ném lại lỗi đã được xử lý
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Không thể đăng ký: ${error.message}`);
  }
  // 8. Trả về user đã tạo
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
