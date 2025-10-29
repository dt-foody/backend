const BaseController = require('../utils/_base.controller.js');
const { employeeService } = require('../services/index.js');

class EmployeeController extends BaseController {
  constructor() {
    super(employeeService);
  }
}

module.exports = new EmployeeController();