const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const dealSettingSchema = mongoose.Schema(
  {
    allowFastDelivery: { type: Boolean, default: false },
    allowScheduledDelivery: { type: Boolean, default: false },
    allowCashPayment: { type: Boolean, default: false },
    allowBankTransfer: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Thêm plugin để convert sang JSON và phân trang (đúng chuẩn dự án của bạn)
dealSettingSchema.plugin(toJSON);
dealSettingSchema.plugin(paginate);

const DealSetting = mongoose.model('DealSetting', dealSettingSchema);

module.exports = DealSetting;
