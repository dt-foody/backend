// models/pricePromotion.model.js
const mongoose = require('mongoose');

const { Schema } = mongoose;
const { toJSON, paginate } = require('./plugins');

const PricePromotionSchema = new Schema(
  {
    // Tên chương trình
    name: { type: String, required: true, trim: true },

    // Mô tả ngắn
    description: { type: String, default: '' },

    // Áp dụng cho Product hoặc Combo
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    combo: { type: Schema.Types.ObjectId, ref: 'Combo' },

    // Loại giảm giá: percentage (%) hoặc fixed (tiền cố định)
    discountType: { type: String, enum: ['percentage', 'fixed_amount'], required: true },
    discountValue: { type: Number, required: true, min: 0 },

    // Thời gian hiệu lực
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Số lượng tối đa áp dụng giảm giá
    maxQuantity: { type: Number, default: 0 },
    // Đếm số lượng đã sử dụng / đã bán trong promotion
    usedQuantity: { type: Number, default: 0 },

    // Số lần tối đa được sử dụng trong 1 ngày
    dailyMaxUses: { type: Number, default: 0 },
    // Lưu trữ ngày cuối cùng coupon được dùng
    lastUsedDate: { type: Date },
    // Số lần đã dùng trong ngày hiện tại
    dailyUsedCount: { type: Number, default: 0 },

    // Thêm trường giới hạn trên mỗi User
    maxQuantityPerCustomer: { type: Number, default: 0 }, // 0 là không giới hạn

    // Trạng thái
    isActive: { type: Boolean, default: true },

    // Độ ưu tiên của khuyến mãi
    priority: { type: Number, default: 0 },

    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Index để tìm nhanh promotion đang hoạt động theo sản phẩm/combo và thời gian
PricePromotionSchema.index({ productId: 1, comboId: 1, isActive: 1, startDate: 1, endDate: 1 });

// Plugins
PricePromotionSchema.plugin(toJSON);
PricePromotionSchema.plugin(paginate);

const PricePromotion = mongoose.model('PricePromotion', PricePromotionSchema);
module.exports = PricePromotion;
