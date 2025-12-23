const BaseController = require('../utils/_base.controller');
const dealSettingService = require('../services/dealSetting.service');

class DealSettingController extends BaseController {
  constructor() {
    super(dealSettingService);
  }
}

module.exports = new DealSettingController();
