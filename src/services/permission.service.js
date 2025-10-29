const BaseService = require('../utils/_base.service.js');
const { Permission } = require('../models/index.js');

class PermissionService extends BaseService {
  constructor() {
    super(Permission);
  }
}

module.exports = new PermissionService();