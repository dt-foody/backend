const BaseService = require('../utils/_base.service');
const { DealSetting } = require('../models');

class DealSettingService extends BaseService {
  constructor() {
    super(DealSetting);
  }
}

module.exports = new DealSettingService();
