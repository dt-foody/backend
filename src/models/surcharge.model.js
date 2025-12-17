const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const surchargeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
surchargeSchema.plugin(toJSON);
surchargeSchema.plugin(paginate);

/**
 * @typedef Surcharge
 */
const Surcharge = mongoose.model('Surcharge', surchargeSchema);

module.exports = Surcharge;
