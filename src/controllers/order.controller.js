const BaseController = require('../utils/_base.controller.js');
const { orderService } = require('../services/index.js');

class OrderController extends BaseController {
  constructor() {
    super(orderService);
  }
}

module.exports = new OrderController();
