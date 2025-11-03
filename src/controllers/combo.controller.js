const BaseController = require('../utils/_base.controller.js');
const { comboService } = require('../services/index.js');

class ComboController extends BaseController {
  constructor() {
    super(comboService);
  }
}

module.exports = new ComboController();
