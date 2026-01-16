const BaseService = require('../utils/_base.service');
const { LayoutSetting } = require('../models');

class LayoutSettingService extends BaseService {
  constructor() {
    super(LayoutSetting);
  }
}

module.exports = new LayoutSettingService();
