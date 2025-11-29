// models/customer.model.js
const mongoose = require('mongoose');
const validator = require('validator');
const { toJSON, paginate } = require('./plugins');
const Counter = require('./counter.model');

const { Schema } = mongoose;

const CustomerSchema = new Schema(
  {
    // --- ID tăng tự động ---
    customerId: { type: Number, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },

    // --- THÔNG TIN XÁC THỰC & CƠ BẢN ---
    name: { type: String, required: true, trim: true },

    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    birthDate: { type: Date },

    // ✉️ EMAILS — mảng gồm type và value
    emails: [
      {
        _id: false,
        type: {
          type: String,
          enum: ['Home', 'Company', 'Other'],
          default: 'Other',
        },
        value: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
          validate: {
            validator: (v) => validator.isEmail(v),
            message: (props) => `${props.value} is not a valid email address!`,
          },
        },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // 📞 PHONES — mảng gồm type và value
    phones: [
      {
        _id: false,
        type: {
          type: String,
          enum: ['Home', 'Company', 'Other'],
          default: 'Other',
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // --- ĐỊA CHỈ GIAO HÀNG ---
    addresses: [
      {
        label: { type: String },
        recipientName: { type: String, required: true },
        recipientPhone: { type: String, required: true },
        street: { type: String, required: true },
        ward: { type: String, required: true },
        district: { type: String, required: true },
        city: { type: String, required: true },
        fullAddress: { type: String },
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number] }, // [lng, lat]
        },
        isDefault: { type: Boolean, default: false },
      },
    ],

    // isNew: {type: Boolean, default: true },
    lastOrderDate: { type: Date },
    totalOrder: { type: Number, default: 0 },

    // --- NGHIỆP VỤ ---
    // orderHistory: [{ type: Schema.Types.ObjectId, ref: 'Order' }],

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- AUTO-INCREMENT customerId ---
CustomerSchema.pre('save', async function (next) {
  const customer = this;
  if (customer.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { sequenceName: 'customerId' },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );
    customer.customerId = counter.sequenceValue;
  }
  next();
});

CustomerSchema.index({ 'emails.value': 1 });
CustomerSchema.index({ 'phones.value': 1 });

// --- PLUGIN ---
CustomerSchema.plugin(toJSON);
CustomerSchema.plugin(paginate);

const Customer = mongoose.model('Customer', CustomerSchema);
module.exports = Customer;
