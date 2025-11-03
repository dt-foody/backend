const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { customerService } = require('../services');

const { OK } = httpStatus;

class CustomerController extends BaseController {
  constructor() {
    super(customerService);
  }

  async updateProfile(req, res) {
    const { user, body } = req;

    const newData = await customerService.updateOne(
      {
        user: user._id || user.id,
      },
      {
        $set: body,
      }
    );

    res.status(OK).json(newData);
  }
}

module.exports = new CustomerController();
