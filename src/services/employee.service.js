const BaseService = require('../utils/_base.service.js');
const { Employee } = require('../models/index.js');

class EmployeeService extends BaseService {
  constructor() {
    super(Employee);
  }
}

module.exports = new EmployeeService();