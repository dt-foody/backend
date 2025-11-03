const BaseService = require('../utils/_base.service');
const { PricePromotion } = require('../models');

class PricePromotionService extends BaseService {
  constructor() {
    super(PricePromotion);
  }
}

module.exports = new PricePromotionService();
