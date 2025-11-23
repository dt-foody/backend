const mongoose = require('mongoose');
const BaseService = require('../utils/_base.service');
const { PricePromotion, Order } = require('../models');

class PricePromotionService extends BaseService {
  constructor() {
    super(PricePromotion);

    this.getValidPromotion = this.getValidPromotion.bind(this);
    this.consumePromotion = this.consumePromotion.bind(this);
  }

  /**
   * Kiểm tra và lấy khuyến mãi hợp lệ cho 1 sản phẩm
   */
  async getValidPromotion(productId, userId = null) {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Tìm promotion đang active cho product này
    const promo = await this.model
      .findOne({
        product: productId,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .sort({ priority: -1, createdAt: -1 }); // Lấy ưu tiên cao nhất

    if (!promo) return null;

    // 2. Check Global Limit (Tổng số lượng)
    if (promo.maxQuantity > 0 && promo.usedQuantity >= promo.maxQuantity) {
      return null;
    }

    // 3. Check Daily Limit (Số lượng theo ngày)
    // Logic reset mềm: Nếu lastUsedDate là ngày hôm qua, coi như dailyUsedCount = 0
    let currentDailyCount = promo.dailyUsedCount;
    if (promo.lastUsedDate && promo.lastUsedDate < startOfDay) {
      currentDailyCount = 0;
    }

    if (promo.dailyMaxUses > 0 && currentDailyCount >= promo.dailyMaxUses) {
      return null;
    }

    // 4. Check User Limit (Số lượng theo khách hàng)
    if (userId && promo.maxQuantityPerCustomer > 0) {
      // Đếm trong bảng Order xem user này đã mua bao nhiêu item dính promo này
      // Lưu ý: Query này có thể nặng nếu data lớn, nên đánh index cho Order
      const orderStats = await Order.aggregate([
        {
          $match: {
            profile: new mongoose.Types.ObjectId(userId), // Giả sử profile lưu userId
            status: { $ne: 'canceled' }, // Không tính đơn hủy
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.promotion': promo._id } },
        { $group: { _id: null, totalBought: { $sum: '$items.quantity' } } },
      ]);

      const userBoughtCount = orderStats.length > 0 ? orderStats[0].totalBought : 0;
      if (userBoughtCount >= promo.maxQuantityPerCustomer) {
        return null;
      }
    }

    return promo;
  }

  /**
   * Cập nhật số lượng đã dùng (Atomic Update)
   * Trả về true nếu thành công, false nếu hết suất
   */
  async consumePromotion(promoId, quantityToConsume) {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // CASE A: Reset ngày mới (nếu lastUsedDate < hôm nay)
    // Cố gắng update reset count về 0 + quantity
    const resetUpdate = await this.model.findOneAndUpdate(
      {
        _id: promoId,
        lastUsedDate: { $lt: startOfDay }, // Điều kiện: chưa dùng hôm nay
        // Vẫn phải check tổng global
        $expr: { $lte: [{ $add: ['$usedQuantity', quantityToConsume] }, '$maxQuantity'] },
      },
      {
        $set: { dailyUsedCount: quantityToConsume, lastUsedDate: now },
        $inc: { usedQuantity: quantityToConsume },
      },
      { new: true }
    );

    if (resetUpdate) return true;

    // CASE B: Đã dùng trong ngày, chỉ tăng count
    // Phải thỏa mãn cả Global Limit và Daily Limit
    const normalUpdate = await this.model.findOneAndUpdate(
      {
        _id: promoId,
        lastUsedDate: { $gte: startOfDay }, // Điều kiện: đã dùng hôm nay
        $and: [
          // Check Global: used + qty <= max
          { $expr: { $lte: [{ $add: ['$usedQuantity', quantityToConsume] }, '$maxQuantity'] } },
          // Check Daily: daily + qty <= dailyMax
          { $expr: { $lte: [{ $add: ['$dailyUsedCount', quantityToConsume] }, '$dailyMaxUses'] } },
        ],
      },
      {
        $inc: { usedQuantity: quantityToConsume, dailyUsedCount: quantityToConsume },
        $set: { lastUsedDate: now },
      },
      { new: true }
    );

    return !!normalUpdate;
  }
}

module.exports = new PricePromotionService();
