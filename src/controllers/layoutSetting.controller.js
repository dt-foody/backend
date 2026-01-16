const BaseController = require('../utils/_base.controller');
const { layoutSettingService } = require('../services');

class LayoutSettingController extends BaseController {
  constructor() {
    super(layoutSettingService);
  }
}

module.exports = new LayoutSettingController();
