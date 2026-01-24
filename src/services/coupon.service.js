/* eslint-disable no-unused-vars */
const mongoose = require('mongoose');
const _ = require('lodash');
const BaseService = require('../utils/_base.service');
const { evaluateConditions, requiresUserContext } = require('../utils/conditionEvaluator');
const { Coupon, Voucher, Order } = require('../models');

class CouponService extends BaseService {
  constructor() {
    super(Coupon);
    this.getAvailableCoupons = this.getAvailableCoupons.bind(this);
  }

  /**
   * Lấy coupon khả dụng (Public + Private)
   * @param {Object} req
   * @param {Number} orderValue
   * @param {Array} orderItems
   */
  async getAvailableCoupons(req, orderValue = 0, orderItems = []) {
    const { user, profile, profileType } = req;

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
      .populate({
        path: 'giftItems.item',
      })
      .lean();

    // [FIX LOGIC] 1a. Kiểm tra lịch sử sử dụng của User với danh sách Public Coupons này
    const usageMap = {};
    if (user && profile && publicCoupons.length > 0) {
      const couponCodes = publicCoupons.map((c) => c.code);
      const profileId = profile.id || profile._id;

      // Đếm số lần profile này đã dùng các mã trên trong các đơn thành công
      const usageStats = await Order.aggregate([
        {
          $match: {
            profile: new mongoose.Types.ObjectId(profileId), // Cast về ObjectId để match chính xác
            status: { $ne: 'canceled' }, // Không tính đơn đã hủy
            'appliedCoupons.code': { $in: couponCodes },
          },
        },
        { $unwind: '$appliedCoupons' }, // Tách mảng coupon để filter
        {
          $match: {
            'appliedCoupons.code': { $in: couponCodes },
          },
        },
        {
          $group: {
            _id: '$appliedCoupons.code', // Group theo mã coupon
            count: { $sum: 1 }, // Đếm số lần xuất hiện
          },
        },
      ]);

      // Map kết quả về dạng Object cho dễ tra cứu: { 'SALE50': 1, 'FREESHIP': 2 }
      usageStats.forEach((stat) => {
        usageMap[stat._id] = stat.count;
      });
    }

    const formattedPublic = publicCoupons
      .map((c) => {
        let isApplicable = true;
        let reason = null;

        // [FIX LOGIC] 1b. Validate maxUsesPerUser
        const userUsedCount = usageMap[c.code] || 0;
        if (c.maxUsesPerUser > 0 && userUsedCount >= c.maxUsesPerUser) {
          isApplicable = false;
          reason = 'MAX_USES_PER_USER_REACHED';
        }

        // Check điều kiện động (Conditions)
        const hasConditions =
          c.conditions &&
          c.conditions.conditions &&
          Array.isArray(c.conditions.conditions) &&
          c.conditions.conditions.length > 0;

        // Chỉ check conditions nếu các điều kiện cơ bản ở trên đã pass
        if (isApplicable && hasConditions) {
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

        // Check giá trị đơn hàng tối thiểu
        if (isApplicable && orderValue < c.minOrderAmount) {
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
          userUsage: {
            used: userUsedCount,
            limit: c.maxUsesPerUser,
          },
        };
      })
      // [NEW] Filter bỏ các coupon đã hết lượt dùng cá nhân để không hiện lên UI
      .filter((c) => c.inapplicableReason !== 'MAX_USES_PER_USER_REACHED');

    if (!user || !profile) return formattedPublic;

    // 2. Get Private Vouchers
    const vouchers = await Voucher.find({
      profile: profile.id || profile._id,
      status: 'UNUSED',
      expiredAt: { $gte: now },
    })
      .populate({
        path: 'coupon',
        populate: {
          path: 'giftItems.item',
          select: 'name image',
        },
      })
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
