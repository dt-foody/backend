const BaseController = require('../utils/_base.controller');
const { surchargeService } = require('../services');

class SurchargeController extends BaseController {
  constructor() {
    super(surchargeService);
  }
}

module.exports = new SurchargeController();
