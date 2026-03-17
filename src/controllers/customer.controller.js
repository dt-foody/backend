const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { customerService, employeeService, userService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class CustomerController extends BaseController {
  constructor() {
    super(customerService);

    this.updateProfile = catchAsync(this.updateProfile.bind(this));
    this.getReferral = catchAsync(this.getReferral.bind(this));
  }

  async updateProfile(req, res) {
    const { profileType, user, body } = req;
    const userId = user._id || user.id;

    const userPatch = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      userPatch.name = body.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
      userPatch.avatar = body.avatar || null;
    }

    if (Object.keys(userPatch).length > 0) {
      await userService.updateOne({ _id: userId }, { $set: userPatch });
    }

    let newData;
    if (profileType === 'Customer') {
      newData = await this.service.updateOne(
        {
          user: userId,
        },
        {
          $set: body,
        }
      );
    } else {
      newData = await employeeService.updateOne(
        {
          user: userId,
        },
        {
          $set: body,
        }
      );
    }

    res.status(OK).json(newData);
  }

  async getReferral(req, res) {
    const { profile } = req;
    const customerId = profile ? profile._id || profile.id : null;

    if (!customerId) {
      return res.status(OK).json({
        results: [],
        page: 1,
        limit: 20,
        totalPages: 1,
        totalResults: 0,
      });
    }

    const result = await this.service.paginate({
      referredBy: customerId,
    });
    return res.status(OK).json(result);
  }
}

module.exports = new CustomerController();
