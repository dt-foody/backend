const BaseController = require('../utils/_base.controller.js');
const { pricePromotionService } = require('../services/index.js');

class PricePromotionController extends BaseController {
  constructor() {
    super(pricePromotionService);
  }
}

module.exports = new PricePromotionController();
