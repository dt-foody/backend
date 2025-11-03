const BaseController = require('../utils/_base.controller');
const { permissionService } = require('../services');

class PermissionController extends BaseController {
  constructor() {
    super(permissionService);
  }
}

module.exports = new PermissionController();
