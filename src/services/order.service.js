const BaseService = require('../utils/_base.service.js');
const { Order } = require('../models/index.js');

class OrderService extends BaseService {
  constructor() {
    super(Order);
  }
}

module.exports = new OrderService();