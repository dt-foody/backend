const BaseService = require('../utils/_base.service.js');
const { Role } = require('../models/index.js');

class RoleService extends BaseService {
  constructor() {
    super(Role);
  }
}

module.exports = new RoleService();
