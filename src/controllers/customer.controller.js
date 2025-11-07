const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { customerService, employeeService } = require('../services');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

const { OK } = httpStatus;

class CustomerController extends BaseController {
  constructor() {
    super(customerService);

    this.updateProfile = catchAsync(this.updateProfile.bind(this));
  }

  async updateProfile(req, res) {
    const { user, body } = req;

    let newData;
    if (user.profileType === 'Customer') {
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
}

module.exports = new CustomerController();
