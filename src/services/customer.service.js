const BaseService = require('../utils/_base.service');
const { Customer } = require('../models');

class CustomerService extends BaseService {
  constructor() {
    super(Customer);
  }
}

module.exports = new CustomerService();
