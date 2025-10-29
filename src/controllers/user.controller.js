const BaseController = require('../utils/_base.controller.js');
const { userService } = require('../services/index.js');

class UserController extends BaseController {
  constructor() {
    super(userService);
  }
}

module.exports = new UserController();