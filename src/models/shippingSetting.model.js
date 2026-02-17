const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const ShippingSettingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Priority: Higher number = Higher priority
    priority: {
      type: Number,
      default: 0,
    },
    // Condition builder JSON
    conditions: {
      type: Object,
      default: null,
      /*
              Example:
              {
                type: 'group',
                operator: 'and',
                children: [
                  { type: 'rule', field: 'distance', operator: '<', value: 5 },
                  { type: 'rule', field: 'subtotal', operator: '>=', value: 100000 }
                ]
              }
            */
    },
    // Fixed Fee applied if conditions match
    fixedFee: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Add plugins
ShippingSettingSchema.plugin(toJSON);
ShippingSettingSchema.plugin(paginate);

// Indexes
ShippingSettingSchema.index({ priority: -1, isActive: 1 });

module.exports = mongoose.model('ShippingSetting', ShippingSettingSchema);
