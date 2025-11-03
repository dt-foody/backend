const BaseController = require('../utils/_base.controller');
const { orderService } = require('../services');

class OrderController extends BaseController {
  constructor() {
    super(orderService);
  }
}

module.exports = new OrderController();
