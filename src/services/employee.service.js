const BaseService = require('../utils/_base.service');
const { Employee } = require('../models');

class EmployeeService extends BaseService {
  constructor() {
    super(Employee);
  }
}

module.exports = new EmployeeService();
