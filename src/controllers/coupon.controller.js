const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { couponService, voucherService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK, CREATED } = httpStatus;

class CouponController extends BaseController {
  constructor() {
    super(couponService);
    this.available = catchAsync(this.available.bind(this));
    this.claim = catchAsync(this.claim.bind(this));
  }

  async available(req, res) {
    const { orderValue } = req.query;
    // req.user sẽ null nếu guest, middleware auth phải để 'optional'
    const result = await this.service.getAvailableCoupons(req.user, Number(orderValue) || 0);
    res.status(OK).json(result);
  }

  async claim(req, res) {
    const voucher = await voucherService.claimCoupon(req.user.id, req.body.code);
    res.status(CREATED).json(voucher);
  }
}

module.exports = new CouponController();
