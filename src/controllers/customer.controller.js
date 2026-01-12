const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { customerService, employeeService } = require('../services');
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

    let newData;
    if (profileType === 'Customer') {
      newData = await this.service.updateOne(
        {
          user: user._id || user.id,
        },
        {
          $set: body,
        }
      );
    } else {
      newData = await employeeService.updateOne(
        {
          user: user._id || user.id,
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
