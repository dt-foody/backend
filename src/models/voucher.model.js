// models/Voucher.model.js
const mongoose = require('mongoose');

const { Schema } = mongoose;
const { toJSON, paginate } = require('./plugins');

const DiscountSnapshotSchema = new Schema(
  {
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true },
    maxDiscount: { type: Number, default: 0 },
  },
  { _id: false }
);

const VoucherSchema = new Schema(
  {
    // --- Liên kết ---
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },

    // --- Mã voucher ---
    code: { type: String, unique: true, required: true },

    // --- Nguồn phát hành ---
    issueMode: {
      type: String,
      enum: ['CLAIM', 'ADMIN', 'AUTO', 'REFERRAL'],
      default: 'CLAIM',
    },

    // --- Trạng thái ---
    status: {
      type: String,
      enum: ['UNUSED', 'USED', 'EXPIRED', 'REVOKED'],
      default: 'UNUSED',
    },

    issuedAt: { type: Date, default: Date.now },
    usedAt: { type: Date },
    expiredAt: { type: Date },
    revokeAt: { type: Date },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // --- Thống kê ---
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 1 },

    // --- Snapshot rule tại thời điểm issue ---
    discountSnapshot: { type: DiscountSnapshotSchema, required: true },

    // --- Audit ---
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- Index ---
VoucherSchema.index({ customer: 1 });
VoucherSchema.index({ coupon: 1 });
VoucherSchema.index({ code: 1 }, { unique: true });
VoucherSchema.index({ status: 1, expiredAt: 1 });

// --- Plugins ---
VoucherSchema.plugin(toJSON);
VoucherSchema.plugin(paginate);

module.exports = mongoose.model('Voucher', VoucherSchema);
