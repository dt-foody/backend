const mongoose = require('mongoose');

const { Schema } = mongoose;
const { toJSON, paginate } = require('./plugins');

const AuditLogSchema = new Schema(
  {
    // --- 1. ĐỐI TƯỢNG BỊ THAY ĐỔI (Generic Reference) ---
    target: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel', // 🔥 Key chính để đa hình
    },
    targetModel: {
      type: String,
      required: true,
      enum: ['Order', 'Customer', 'Product', 'Voucher', 'User'], // Danh sách các model cần log
    },

    // --- 2. HÀNH ĐỘNG ---
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'], // Các loại hành động
    },

    // --- 3. NGƯỜI THỰC HIỆN ---
    performer: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Thường là tài khoản Admin/Staff đăng nhập
      default: null,
    },
    // Nếu muốn log cả khách hàng tự sửa, thêm performerType giống Order

    // --- 4. CHI TIẾT THAY ĐỔI ---
    // Lưu mảng các thay đổi: { field: "status", old: "pending", new: "completed" }
    changes: [
      {
        field: { type: String, required: true },
        oldValue: { type: Schema.Types.Mixed }, // Mixed để lưu số, chuỗi, date...
        newValue: { type: Schema.Types.Mixed },
        _id: false,
      },
    ],

    // --- 5. METADATA KHÁC ---
    ipAddress: { type: String },
    userAgent: { type: String },
    note: { type: String }, // Ghi chú lý do (nếu có)
  },
  {
    timestamps: true, // Tự động có createdAt
  }
);

AuditLogSchema.plugin(toJSON);
AuditLogSchema.plugin(paginate);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
