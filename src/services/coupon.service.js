const BaseService = require('../utils/_base.service.js');
const { Coupon } = require('../models/index.js');

class CouponService extends BaseService {
  constructor() {
    super(Coupon);
  }
}

module.exports = new CouponService();
