const BaseController = require('../utils/_base.controller');
const shippingSettingService = require('../services/shippingSetting.service');

class ShippingSettingController extends BaseController {
  constructor() {
    super(shippingSettingService);
  }
}

module.exports = new ShippingSettingController();
