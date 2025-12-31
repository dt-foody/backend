const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// Định nghĩa Schema con cho từng tùy chọn để tái sử dụng
const dealOptionConfigSchema = mongoose.Schema(
  {
    value: { type: Boolean, default: false },
    note: { type: String, default: '' },
    activeNote: { type: Boolean, default: false },
    showNoteWhen: {
      type: String,
      enum: ['on', 'off', 'always'],
      default: 'off',
    },
  },
  { _id: false }
); // _id: false để tránh tạo ID thừa cho các object con này

const dealSettingSchema = mongoose.Schema(
  {
    // ============================================================
    // 1. CẤU HÌNH LOẠI HÌNH DỊCH VỤ (MỚI)
    // ============================================================
    homeDelivery: {
      type: dealOptionConfigSchema,
      default: () => ({}), // Mặc định bật giao hàng
    },
    storePickup: {
      type: dealOptionConfigSchema,
      default: () => ({}), // Mặc định bật đến lấy
    },

    // ============================================================
    // 2. CẤU HÌNH CHI TIẾT GIAO HÀNG
    // ============================================================
    fastDelivery: {
      type: dealOptionConfigSchema,
      default: () => ({}),
    },
    scheduledDelivery: {
      type: dealOptionConfigSchema,
      default: () => ({}),
    },

    // ============================================================
    // 3. CẤU HÌNH THANH TOÁN
    // ============================================================
    cashPayment: {
      type: dealOptionConfigSchema,
      default: () => ({}),
    },
    bankTransfer: {
      type: dealOptionConfigSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Thêm plugin để convert sang JSON và phân trang
dealSettingSchema.plugin(toJSON);
dealSettingSchema.plugin(paginate);

const DealSetting = mongoose.model('DealSetting', dealSettingSchema);

module.exports = DealSetting;
