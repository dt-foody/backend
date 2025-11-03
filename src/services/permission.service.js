const BaseService = require('../utils/_base.service');
const { Permission } = require('../models');

class PermissionService extends BaseService {
  constructor() {
    super(Permission);
  }
}

module.exports = new PermissionService();
