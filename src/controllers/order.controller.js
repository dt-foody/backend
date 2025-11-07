const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { orderService, customerService, employeeService } = require('../services');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

const { OK, NOT_FOUND } = httpStatus;

class OrderController extends BaseController {
  constructor() {
    super(orderService);

    this.customerOrder = catchAsync(this.customerOrder.bind(this));
    this.getByCode = catchAsync(this.getByCode.bind(this));
  }

  async customerOrder(req, res) {
    const data = { ...req.body };

    const userId = req.user.id || req.user._id;

    if (req.user.role === 'customer') {
      const customer = await customerService.findOne({ user: userId });

      if (!customer) {
        throw new ApiError(NOT_FOUND, 'Customer not found');
      }

      data.profileType = 'Customer';
      data.profile = customer._id || customer.id;
    } else {
      const employee = await employeeService.findOne({ user: userId });
      
      if (!employee) {
        throw new ApiError(NOT_FOUND, 'Employee not found');
      }

      data.profileType = 'Employee';
      data.profile = employee._id || employee.id;
    }
    
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
