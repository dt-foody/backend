// models/payos.model.js
const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const Counter = require('./counter.model');

const { Schema } = mongoose;

const PayOSSchema = new Schema(
  {
    // --- ID tăng tự động ---
    payosId: { type: Number, unique: true },

    // --- DỮ LIỆU WEBHOOK GỬI VÀO ---
    body: { type: Schema.Types.Mixed, required: true }, // Lưu toàn bộ request từ PayOS
    verified: { type: Boolean, default: false }, // Đã verify thành công chưa
    verifyError: { type: String, default: null }, // Nếu verify fail thì lưu lỗi
    orderCode: { type: Number, index: true }, // Cho phép tra cứu theo mã đơn hàng
    paymentLinkId: { type: String, index: true },
    reference: { type: String, index: true },

    // --- THÔNG TIN TRẠNG THÁI ---
    status: {
      type: String,
      enum: ['pending', 'verified', 'invalid', 'processed'],
      default: 'pending',
    },
    processedAt: { type: Date, default: null },

    // --- METADATA ---
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- AUTO-INCREMENT payosId ---
PayOSSchema.pre('save', async function (next) {
  const doc = this;
  if (doc.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { sequenceName: 'payosId' },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );
    doc.payosId = counter.sequenceValue;
  }
  next();
});

// --- PLUGIN ---
PayOSSchema.plugin(toJSON);
PayOSSchema.plugin(paginate);

const PayOS = mongoose.model('PayOS', PayOSSchema);
module.exports = PayOS;
