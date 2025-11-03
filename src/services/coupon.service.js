const BaseService = require('../utils/_base.service');
const { Coupon } = require('../models');

class CouponService extends BaseService {
  constructor() {
    super(Coupon);
  }
}

module.exports = new CouponService();
