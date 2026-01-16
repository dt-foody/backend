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

const layoutSettingSchema = mongoose.Schema(
  {
    headerNavItems: {
      type: [headerNavItemSchema],
      default: [],
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
