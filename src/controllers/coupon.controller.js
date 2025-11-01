const BaseController = require('../utils/_base.controller.js');
const { couponService } = require('../services/index.js');
const httpStatus = require('http-status');

const { OK } = httpStatus;

class CouponController extends BaseController {
  constructor() {
    super(couponService);
  }

  async available(req, res) {
    const coupons = await couponService.findAll({
      status: 'ACTIVE',
      public: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      $or: [
        { maxUses: 0 },
        { $expr: { $lt: ['$usedCount', '$maxUses'] } },
      ]
    });

    return res.status(OK).json(coupons);
  }
}

module.exports = new CouponController();