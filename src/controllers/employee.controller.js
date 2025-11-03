const BaseController = require('../utils/_base.controller');
const { employeeService } = require('../services');

class EmployeeController extends BaseController {
  constructor() {
    super(employeeService);
  }
}

module.exports = new EmployeeController();
