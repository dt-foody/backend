const BaseController = require('../utils/_base.controller.js');
const { customerService } = require('../services/index.js');

class CustomerController extends BaseController {
  constructor() {
    super(customerService);
  }
}

module.exports = new CustomerController();