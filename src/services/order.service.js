const BaseService = require('../utils/_base.service');
const { Order } = require('../models');

class OrderService extends BaseService {
  constructor() {
    super(Order);
  }
}

module.exports = new OrderService();
