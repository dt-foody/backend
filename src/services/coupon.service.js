/* eslint-disable no-unused-vars */
const _ = require('lodash');
const BaseService = require('../utils/_base.service');
const { evaluateConditions } = require('../utils/conditionEvaluator');
const { Coupon, Voucher } = require('../models');

class CouponService extends BaseService {
  constructor() {
    super(Coupon);
    this.getAvailableCoupons = this.getAvailableCoupons.bind(this);
  }

  /**
   * Lấy coupon khả dụng (Public + Private)
   * @param {Object} user
   * @param {Number} orderValue
   * @param {Array} orderItems
   */
  async getAvailableCoupons(user, orderValue = 0, orderItems = []) {
    const now = new Date();

    // Context cho evaluator
    const context = {
      user,
      order: { totalPrice: orderValue, items: orderItems, createdAt: now },
    };

    // 1. Get Public Coupons
    const publicCoupons = await this.model.find({
      status: 'ACTIVE',
      public: true,
      claimable: false,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [{ maxUses: 0 }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
    });

    const formattedPublic = publicCoupons.map((c) => {
      // eslint-disable-next-line no-param-reassign
      c = c.toObject();
      let isApplicable = true;
      let reason = null;

      // Check conditions (Chỉ check nếu mảng conditions con có dữ liệu)
      const hasConditions = c.conditions && Array.isArray(c.conditions) && c.conditions.length > 0;

      if (hasConditions) {
        if (!user) {
          isApplicable = false;
          reason = 'LOGIN_REQUIRED';
        } else {
          const passed = evaluateConditions(c.conditions, context);
          if (!passed) {
            isApplicable = false;
            reason = 'CONDITIONS_NOT_MET';
          }
        }
      }

      if (orderValue < c.minOrderAmount) {
        isApplicable = false;
        reason = reason || 'MIN_ORDER_AMOUNT_NOT_MET';
      }

      return {
        ...c,
        id: c._id || c.id,
        type: 'PUBLIC',
        isClaimed: false,
        isApplicable,
        inapplicableReason: reason,
      };
    });

    if (!user) return formattedPublic; // Trả về nếu là Guest

    // 2. Get Private Vouchers
    const vouchers = await Voucher.find({
      customer: user.id,
      status: 'UNUSED',
      expiredAt: { $gte: now },
    })
      .populate('coupon', 'name description')
      .lean();

    const formattedPersonal = vouchers.map((v) => {
      let isApplicable = true;
      let reason = null;
      if (orderValue < v.discountSnapshot.minOrderAmount) {
        isApplicable = false;
        reason = 'MIN_ORDER_AMOUNT_NOT_MET';
      }
      return {
        id: v.coupon._id,
        voucherId: v._id,
        code: v.code,
        name: v.coupon?.name,
        description: v.coupon?.description,
        value: v.discountSnapshot.value,
        valueType: v.discountSnapshot.type,
        minOrderAmount: v.discountSnapshot.minOrderAmount,
        maxDiscountAmount: v.discountSnapshot.maxDiscount,
        endDate: v.expiredAt,
        type: 'PERSONAL',
        isClaimed: true,
        isApplicable,
        inapplicableReason: reason,
      };
    });

    return [...formattedPublic, ...formattedPersonal];
  }
}

module.exports = new CouponService();
