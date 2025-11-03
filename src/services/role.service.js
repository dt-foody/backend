const BaseService = require('../utils/_base.service');
const { Role } = require('../models');

class RoleService extends BaseService {
  constructor() {
    super(Role);
  }
}

module.exports = new RoleService();
