// models/order.model.ts
const mongoose = require('mongoose');

const { Schema } = mongoose;

const Counter = require('./counter.model');

const { toJSON, paginate } = require('./plugins');

const OrderItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  note: { type: String },
  combo: { type: Schema.Types.ObjectId, ref: 'Combo' }, // nếu sản phẩm nằm trong combo
});

const OrderSchema = new Schema(
  {
    // --- ID tăng tự động ---
    orderId: { type: Number, unique: true },

    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: [OrderItemSchema],
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true }, // tổng cuối cùng
    payment: {
      method: { type: String, enum: ['cash', 'momo', 'vnpay'], default: 'cash' },
      status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
      transactionId: { type: String },
    },
    shipping: {
      address: {
        label: String,
        recipientName: String,
        recipientPhone: String,
        street: String,
        ward: String,
        district: String,
        city: String,
      },
      status: { type: String, enum: ['pending', 'delivering', 'delivered', 'failed'], default: 'pending' },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled'],
      default: 'pending',
    },
    note: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // nhân viên xác nhận
  },
  { timestamps: true }
);

// --- AUTO-INCREMENT customerId ---
OrderSchema.pre('save', async function (next) {
  const order = this;
  if (order.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { sequenceName: 'orderId' },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );
    order.orderId = counter.sequenceValue;
  }
  next();
});

OrderSchema.plugin(toJSON);
OrderSchema.plugin(paginate);

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
