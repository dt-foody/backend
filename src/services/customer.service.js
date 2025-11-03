const BaseService = require('../utils/_base.service.js');
const { Customer } = require('../models/index.js');

class CustomerService extends BaseService {
  constructor() {
    super(Customer);
  }
}

module.exports = new CustomerService();
