const BaseController = require('../utils/_base.controller');
const { pricePromotionService } = require('../services');

class PricePromotionController extends BaseController {
  constructor() {
    super(pricePromotionService);
  }
}

module.exports = new PricePromotionController();
