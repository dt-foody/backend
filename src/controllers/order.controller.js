const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { orderService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class OrderController extends BaseController {
  constructor() {
    super(orderService);

    this.customerOrder = catchAsync(this.customerOrder.bind(this));
    this.getByCode = catchAsync(this.getByCode.bind(this));
  }

  async customerOrder(req, res) {
    const data = { ...req.body };

    data.profileType = req.user.profileType;
    data.profile = req.user.profile._id || req.user.profile.id;

    const result = await this.service.customerOrder(data);
    return res.status(OK).json(result);
  }

  async getByCode(req, res) {
    const { code } = req.params;
    const data = await this.service.findOne({ orderCode: code });
    return res.status(OK).json(data);
  }
}

module.exports = new OrderController();
