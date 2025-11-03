const BaseService = require('../utils/_base.service');
const { User } = require('../models');

class UserService extends BaseService {
  constructor() {
    super(User);
  }

  /**
   * Đổi mật khẩu an toàn tại service
   * @param {number|string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{ ok: boolean, tokenVersion: number }>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Lấy user kèm password (vì toJSON plugin ẩn password)
    const user = await this.model.findById(userId).select('+password');

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Dùng method có sẵn trong model
    const isMatch = await user.isPasswordMatch(currentPassword);
    if (!isMatch) {
      throw new Error('CURRENT_PASSWORD_INCORRECT');
    }

    // Kiểm tra password mới có trùng password cũ không
    const isSame = await user.isPasswordMatch(newPassword);
    if (isSame) {
      throw new Error('PASSWORD_REUSED');
    }

    // Cập nhật password - middleware pre('save') sẽ tự hash
    user.password = newPassword;
    await user.save();
  }
}

module.exports = new UserService();
