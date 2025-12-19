const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { userService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;
class UserController extends BaseController {
  constructor() {
    super(userService);
    this.changePassword = catchAsync(this.changePassword.bind(this));
    this.getReferral = catchAsync(this.getReferral.bind(this));
  }

  // POST /api/users/me/change-password
  async changePassword(req, res) {
    const userId = req.user.id;

    const { currentPassword, newPassword } = req.body;

    await this.service.changePassword(userId, currentPassword, newPassword);
    return res.status(OK).json({ message: 'Password changed' });
  }

  // GET /api/users/me/referral
  async getReferral(req, res) {
    const userId = req.user.id;

    const result = await this.service.paginate({
      referredBy: userId,
    });
    return res.status(OK).json(result);
  }
}

module.exports = new UserController();
