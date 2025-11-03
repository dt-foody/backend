const BaseController = require('../utils/_base.controller');
const { comboService } = require('../services');

class ComboController extends BaseController {
  constructor() {
    super(comboService);
  }
}

module.exports = new ComboController();
