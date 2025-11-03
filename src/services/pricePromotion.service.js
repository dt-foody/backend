const BaseService = require('../utils/_base.service.js');
const { PricePromotion } = require('../models/index.js');

class PricePromotionService extends BaseService {
  constructor() {
    super(PricePromotion);
  }
}

module.exports = new PricePromotionService();
