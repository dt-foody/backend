const BaseService = require('../utils/_base.service.js');
const { User } = require('../models/index.js');

class UserService extends BaseService {
  constructor() {
    super(User);
  }
}

module.exports = new UserService();