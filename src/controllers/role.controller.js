const BaseController = require('../utils/_base.controller');
const { roleService } = require('../services');

class RoleController extends BaseController {
  constructor() {
    super(roleService);
  }
}

module.exports = new RoleController();
