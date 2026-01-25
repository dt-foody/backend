const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    // --- NỘI DUNG ---
    title: { type: String, required: true },
    content: { type: String, required: true }, // Nội dung: Tên, SĐT, Thời gian...
    type: {
      type: String,
      enum: [
        'ORDER_NEW',
        'SYSTEM_ALERT',
        'ORDER_CANCELED_AUTO',
        'ORDER_PAYMENT_REMINDER',
        'ADMIN_REMINDER_PREP',
        'ADMIN_REMINDER_SHIP',
        'ORDER_STATUS_UPDATE',
      ],
      default: 'ORDER_NEW',
    },

    // --- LIÊN KẾT (Để click vào xem chi tiết) ---
    referenceId: { type: Schema.Types.ObjectId, required: true, refPath: 'referenceModel' },
    referenceModel: { type: String, required: true, enum: ['Order'] },

    // --- LOGIC NGƯỜI NHẬN ---
    isGlobal: { type: Boolean, default: false }, // applyAll: True = Gửi tất cả Admin/NV
    receivers: [{ type: Schema.Types.ObjectId, ref: 'User' }], // usersNotification: Danh sách cụ thể

    // --- TRACKING NGƯỜI ĐỌC ---
    // Mảng lưu những ai đã đọc và thời gian đọc
    readBy: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

NotificationSchema.index({ referenceId: 1, type: 1 }, { unique: true });
NotificationSchema.index({ receivers: 1, createdAt: -1 });
NotificationSchema.index({ isGlobal: 1, createdAt: -1 });

NotificationSchema.plugin(toJSON);
NotificationSchema.plugin(paginate);

module.exports = mongoose.model('Notification', NotificationSchema);
