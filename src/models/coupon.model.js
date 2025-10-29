// models/Coupon.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSON, paginate } = require('./plugins');

const CouponSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  code: { type: String, unique: true, sparse: true },

  // --- Loại coupon ---
  type: {
    type: String,
    enum: ['discount_code', 'freeship', 'gift'],
    default: 'discount_code'
  },

  // --- Quy tắc giảm giá ---
  value: { type: Number, default: 0 },
  valueType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  maxDiscountAmount: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },

  // --- Hiệu lực ---
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // --- Giới hạn sử dụng ---
  maxUses: { type: Number, default: 0 },
  usedCount: { type: Number, default: 0 },
  maxUsesPerUser: { type: Number, default: 1 },

  // --- Cấu hình hiển thị / hành vi ---
  public: { type: Boolean, default: true },
  claimable: { type: Boolean, default: false },
  autoApply: { type: Boolean, default: false },
  stackable: { type: Boolean, default: false },

  // --- Điều kiện động (runtime condition JSON) ---
  conditions: {
    type: Object,
    default: null
    // ví dụ:
    // { and: [{ field: "user.isNew", operator: "=", value: true }] }
  },

  // --- Trạng thái ---
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED'],
    default: 'ACTIVE'
  },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// --- Index ---
CouponSchema.index({ status: 1, startDate: 1, endDate: 1 });
CouponSchema.index({ code: 1 }, { unique: true, sparse: true });

// --- Plugins ---
CouponSchema.plugin(toJSON);
CouponSchema.plugin(paginate);

module.exports = mongoose.model('Coupon', CouponSchema);
