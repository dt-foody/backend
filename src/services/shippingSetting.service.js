const BaseService = require('../utils/_base.service');
const { ShippingSetting } = require('../models');

class ShippingSettingService extends BaseService {
  constructor() {
    super(ShippingSetting);
  }
}

module.exports = new ShippingSettingService();
