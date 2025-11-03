// src/controllers/coupon.controller.js
const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { couponService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class CouponController extends BaseController {
  constructor() {
    super(couponService);
    // ✅ wrap bằng catchAsync, bind this; KHÔNG dùng class field
    this.available = catchAsync(this.available.bind(this));
  }

  // method chuẩn (prototype method) → ESLint/Node parse được
  async available(req, res) {
    const now = new Date();
    const filter = {
      status: 'ACTIVE',
      public: true, // đổi thành isPublic nếu schema bạn dùng tên đó
      startDate: { $lte: now },
      endDate: { $gte: now },
      isDeleted: { $ne: true },
      $or: [
        { maxUses: 0 }, // không giới hạn
        { $expr: { $lt: ['$usedCount', '$maxUses'] } }, // còn lượt dùng
      ],
    };

    const options = {
      ...(req.options || {}),
      sort: { priority: -1, startDate: 1, createdAt: -1 },
      lean: true,
    };

    const coupons = await this.service.findAll(filter, options);
    return res.status(OK).json(coupons);
  }
}

module.exports = new CouponController();
