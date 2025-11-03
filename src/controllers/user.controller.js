const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { userService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;
class UserController extends BaseController {
  constructor() {
    super(userService);
    this.changePassword = catchAsync(this.changePassword.bind(this));
  }

  // POST /api/users/me/change-password
  async changePassword(req, res) {
    const userId = req.user.id;

    const { currentPassword, newPassword } = req.body;

    await this.service.changePassword(userId, currentPassword, newPassword);
    return res.status(OK).json({ message: 'Password changed' });
  }
}

module.exports = new UserController();
