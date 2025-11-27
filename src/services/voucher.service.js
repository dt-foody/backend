const httpStatus = require('http-status');
const BaseService = require('../utils/_base.service');
const { Voucher, Coupon } = require('../models');
const ApiError = require('../utils/ApiError');

class VoucherService extends BaseService {
  constructor() {
    super(Voucher);
    this.claimCoupon = this.claimCoupon.bind(this);
  }

  async claimCoupon(userId, code) {
    const coupon = await Coupon.findOne({ code, status: 'ACTIVE', public: true });

    if (!coupon) throw new ApiError(httpStatus.NOT_FOUND, 'Mã giảm giá không tồn tại');
    if (!coupon.claimable) throw new ApiError(httpStatus.BAD_REQUEST, 'Mã này không cần lưu');

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) throw new ApiError(httpStatus.BAD_REQUEST, 'Mã đã hết hạn');
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
      throw new ApiError(httpStatus.BAD_REQUEST, 'Mã đã hết lượt');

    const existing = await this.model.countDocuments({ customer: userId, coupon: coupon._id });
    if (existing >= coupon.maxUsesPerUser) throw new ApiError(httpStatus.BAD_REQUEST, 'Bạn đã lưu mã này rồi');

    return this.model.create({
      customer: userId,
      coupon: coupon._id,
      code: coupon.code,
      issueMode: 'CLAIM',
      status: 'UNUSED',
      expiredAt: coupon.endDate,
      discountSnapshot: {
        type: coupon.valueType,
        value: coupon.value,
        maxDiscount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minOrderAmount,
      },
      usageLimit: 1,
    });
  }
}

module.exports = new VoucherService();
