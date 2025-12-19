const httpStatus = require('http-status');
const BaseService = require('../utils/_base.service');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

const { NOT_FOUND, BAD_REQUEST } = httpStatus;

class UserService extends BaseService {
  constructor() {
    super(User);
  }

  async changePassword(userId, currentPassword, newPassword) {
    // Lấy user kèm password (vì toJSON plugin ẩn password)
    const user = await this.model.findById(userId).select('+password');

    if (!user) {
      throw new ApiError(NOT_FOUND, 'USER_NOT_FOUND');
    }

    // Dùng method có sẵn trong model
    const isMatch = await user.isPasswordMatch(currentPassword);
    if (!isMatch) {
      throw new ApiError(BAD_REQUEST, 'CURRENT_PASSWORD_INCORRECT');
    }

    // Kiểm tra password mới có trùng password cũ không
    if (currentPassword === newPassword) {
      throw new ApiError(BAD_REQUEST, 'PASSWORD_REUSED');
    }

    // Cập nhật password - middleware pre('save') sẽ tự hash
    user.password = newPassword;
    await user.save();
  }

  async getListReferrals(userId) {
    const referrals = await this.model.find({ referredBy: userId, isActive: true, isEmailVerified: true }).populate('profile').lean();
    return referrals;
  }
}

module.exports = new UserService();
