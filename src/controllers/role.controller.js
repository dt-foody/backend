const BaseController = require('../utils/_base.controller.js');
const { roleService } = require('../services/index.js');

class RoleController extends BaseController {
  constructor() {
    super(roleService);
  }
}

module.exports = new RoleController();