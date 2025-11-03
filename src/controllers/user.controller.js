const BaseController = require('../utils/_base.controller');
const { userService } = require('../services');
const catchAsync = require('../utils/catchAsync');

class UserController extends BaseController {
  constructor() {
    super(userService);
    this.changePassword = catchAsync(this.changePassword.bind(this));
  }

  // POST /api/users/me/change-password
  async changePassword(req, res) {
    const userId = req.user.id;

    const { currentPassword, newPassword } = req.body;

    const result = await this.service.changePassword(userId, currentPassword, newPassword);
    return res.status(200).json({ message: 'Password changed', tokenVersion: result.tokenVersion });
  }
}

module.exports = new UserController();
