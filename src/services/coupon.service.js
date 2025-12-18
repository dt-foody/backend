/* eslint-disable no-unused-vars */
const _ = require('lodash');
const BaseService = require('../utils/_base.service');
const { evaluateConditions, requiresUserContext } = require('../utils/conditionEvaluator');
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
    const publicCoupons = await this.model
      .find({
        status: 'ACTIVE',
        public: true,
        claimable: false, // Coupon dùng chung, không cần lưu
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [{ maxUses: 0 }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
      })
      .lean();

    const formattedPublic = publicCoupons.map((c) => {
      let isApplicable = true;
      let reason = null;

      const hasConditions =
        c.conditions &&
        c.conditions.conditions &&
        Array.isArray(c.conditions.conditions) &&
        c.conditions.conditions.length > 0;

      if (hasConditions) {
        const needsUser = requiresUserContext(c.conditions);
        if (needsUser && !user) {
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
        id: c._id,
        _id: undefined,
        couponScope: 'PUBLIC',
        isClaimed: false,
        isApplicable,
        inapplicableReason: reason,
      };
    });

    if (!user || !user.profile) return formattedPublic;

    // 2. Get Private Vouchers
    // Lấy voucher của user (Đã lưu hoặc được tặng)
    const vouchers = await Voucher.find({
      profile: user.profile.id || user.profile._id || user.profile,
      status: 'UNUSED',
      expiredAt: { $gte: now },
    })
      .populate('coupon')
      .lean();

    const formattedPersonal = vouchers
      .filter((v) => v.coupon) // Đề phòng trường hợp Coupon gốc bị xóa cứng
      .map((v) => {
        const couponBase = v.coupon;
        const snapshot = v.discountSnapshot || {}; // Lấy thông tin giá trị lúc phát hành

        let isApplicable = true;
        let reason = null;

        // Ưu tiên check theo snapshot (thỏa thuận lúc nhận voucher) hoặc fallback về coupon gốc
        const currentMinOrder = snapshot.minOrderAmount ?? couponBase.minOrderAmount ?? 0;

        if (orderValue < currentMinOrder) {
          isApplicable = false;
          reason = 'MIN_ORDER_AMOUNT_NOT_MET';
        }

        return {
          // A. Lấy toàn bộ data từ Coupon gốc (để có name, description, image...)
          ...couponBase,

          // B. Ghi đè các thông tin quan trọng từ Voucher/Snapshot
          // (Vì voucher có thể có hạn dùng và giá trị khác coupon gốc tại thời điểm dùng)
          id: couponBase._id, // ID của coupon gốc (để group hoặc hiển thị)
          voucherId: v._id, // ID riêng của voucher (để apply khi checkout)
          voucherCode: v.code,

          // Ghi đè giá trị giảm giá từ snapshot (đảm bảo quyền lợi user ko bị đổi)
          value: snapshot.value ?? couponBase.value,
          valueType: snapshot.type ?? couponBase.valueType,
          maxDiscountAmount: snapshot.maxDiscount ?? couponBase.maxDiscountAmount,
          minOrderAmount: currentMinOrder,

          startDate: v.issuedAt, // Ngày bắt đầu là ngày nhận
          endDate: v.expiredAt, // Ngày hết hạn riêng của voucher

          // C. Các cờ đánh dấu
          couponScope: 'PERSONAL',
          isClaimed: true, // Voucher này đã thuộc về user
          isApplicable,
          inapplicableReason: reason,
        };
      });

    // Merge 2 danh sách
    return [...formattedPublic, ...formattedPersonal];
  }
}

module.exports = new CouponService();
