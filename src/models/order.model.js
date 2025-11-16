const mongoose = require('mongoose');

const { Schema } = mongoose;
const Counter = require('./counter.model');
const { toJSON, paginate } = require('./plugins');

/* ============================================================
 * 1. OrderItemOptionSchema
 * ============================================================ */
const OrderItemOptionSchema = new Schema(
  {
    groupName: { type: String, required: true },
    optionName: { type: String, required: true },
    priceModifier: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/* ============================================================
 * 2. ComboSelection Schema
 * ============================================================ */
const OrderItemComboSelectionSchema = new Schema(
  {
    slotName: { type: String, required: true },

    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },

    options: [OrderItemOptionSchema],
  },
  { _id: false }
);

/* ============================================================
 * 3. OrderItem Schema
 * ============================================================ */
const OrderItemSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, refPath: 'itemType', required: true },
    itemType: { type: String, enum: ['Product', 'Combo'], required: true },

    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },

    basePrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },

    options: [OrderItemOptionSchema],
    comboSelections: [OrderItemComboSelectionSchema],

    note: { type: String, default: '' },
  },
  { _id: false }
);

/* ============================================================
 * 4. Main Order Schema
 * ============================================================ */
const OrderSchema = new Schema(
  {
    // Auto-increment readable ID
    orderId: { type: Number, unique: true, index: true },

    // Mã order PayOS sử dụng
    orderCode: { type: Number, index: true }, // 🔥 THÊM TRƯỜNG NÀY
    orderType: {
      type: String,
      enum: ['', 'TakeAway', 'DineIn', 'Delivery'],
      default: '',
    },

    profileType: {
      type: String,
      required() {
        return !!this.profile;
      },
      enum: ['Customer', 'Employee'],
    },
    profile: {
      type: Schema.Types.ObjectId,
      refPath: 'profileType',
      index: true,
    },

    items: [OrderItemSchema],

    totalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    payment: {
      method: {
        type: String,
        enum: ['cash', 'payos', 'momo', 'vnpay', 'bank_transfer'],
        default: 'cash',
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: { type: String, default: '' },
      checkoutUrl: { type: String, default: '' },
      qrCode: { type: String, default: '' }, // Optional cho đầy đủ
    },

    shipping: {
      type: new Schema(
        {
          address: {
            label: String,
            recipientName: String,
            recipientPhone: String,
            street: String,
            ward: String,
            district: String,
            city: String,
          },
          status: {
            type: String,
            enum: ['pending', 'preparing', 'delivering', 'delivered', 'failed', 'canceled'],
            default: 'pending',
          },
        },
        { _id: false }
      ),
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'completed', 'canceled', 'refunded'],
      default: 'pending',
      index: true,
    },

    note: { type: String, default: '' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    /* ============================================================
     * 🔥 Danh sách coupon đã áp dụng
     * ============================================================ */
    appliedCoupons: {
      type: [
        new Schema(
          {
            id: { type: Schema.Types.ObjectId, ref: 'Coupon' },
            code: { type: String },
            type: { type: String },
            value: { type: Number },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

/* ============================================================
 * Auto-Increment orderId
 * ============================================================ */
OrderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { sequenceName: 'orderId' },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );

    this.orderId = counter.sequenceValue;
    next();
  } catch (err) {
    next(err);
  }
});

OrderSchema.plugin(toJSON);
OrderSchema.plugin(paginate);

module.exports = mongoose.model('Order', OrderSchema);
