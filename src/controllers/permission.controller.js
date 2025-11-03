const BaseController = require('../utils/_base.controller.js');
const { permissionService } = require('../services/index.js');

class PermissionController extends BaseController {
  constructor() {
    super(permissionService);
  }
}

module.exports = new PermissionController();
