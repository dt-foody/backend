// models/counter.model.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const CounterSchema = new Schema({
  sequenceName: { type: String, required: true, unique: true }, // VD: 'customerId'
  sequenceValue: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', CounterSchema);
module.exports = Counter;
