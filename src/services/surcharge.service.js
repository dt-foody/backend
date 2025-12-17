const BaseService = require('../utils/_base.service');
const { Surcharge } = require('../models');

class SurchargeService extends BaseService {
  constructor() {
    super(Surcharge);
  }
}

module.exports = new SurchargeService();
