const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const headerNavItemSchema = mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
      allow: '',
    },
    enable: {
      type: Boolean,
      default: true, // Mặc định là bật
    },
  },
  { _id: false }
);

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
);

const layoutSettingSchema = mongoose.Schema(
  {
    headerNavItems: {
      type: [headerNavItemSchema],
      default: [],
    },
    flashSale: {
      type: dealOptionConfigSchema,
      default: () => ({}),
    },
    combo: {
      type: dealOptionConfigSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
layoutSettingSchema.plugin(toJSON);
layoutSettingSchema.plugin(paginate);

/**
 * @typedef LayoutSetting
 */
const LayoutSetting = mongoose.model('LayoutSetting', layoutSettingSchema);

module.exports = LayoutSetting;
