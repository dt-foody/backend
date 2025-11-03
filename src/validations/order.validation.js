const Joi = require('joi');
const { objectId } = require('./custom.validation');

// --- SCHEMA CON: Order Item ---
const orderItemSchema = Joi.object({
  product: Joi.string().custom(objectId).required(),
  name: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  price: Joi.number().required(),
  note: Joi.string().allow('', null),
  combo: Joi.string().custom(objectId).allow('', null),
});

// --- SCHEMA CON: Payment ---
const paymentSchema = Joi.object({
  method: Joi.string().valid('cash', 'momo', 'vnpay').default('cash'),
  status: Joi.string().valid('pending', 'paid', 'failed').default('pending'),
  transactionId: Joi.string().allow('', null),
});

// --- SCHEMA CON: Shipping ---
const shippingSchema = Joi.object({
  address: Joi.object({
    label: Joi.string().allow('', null),
    recipientName: Joi.string().required(),
    recipientPhone: Joi.string().required(),
    street: Joi.string().required(),
    ward: Joi.string().required(),
    district: Joi.string().required(),
    city: Joi.string().required(),
  }).required(),
  status: Joi.string().valid('pending', 'delivering', 'delivered', 'failed').default('pending'),
});

// --- CREATE ORDER ---
const create = {
  body: Joi.object({
    customer: Joi.string().custom(objectId).required(),
    items: Joi.array().items(orderItemSchema).min(1).required(),

    totalAmount: Joi.number().required(),
    discountAmount: Joi.number().min(0).default(0),
    shippingFee: Joi.number().min(0).default(0),
    grandTotal: Joi.number().required(),

    payment: paymentSchema.default({}),
    shipping: shippingSchema.required(),

    status: Joi.string()
      .valid('pending', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled')
      .default('pending'),

    note: Joi.string().allow('', null),
    createdBy: Joi.string().custom(objectId).optional(),
  }),
};

// --- PAGINATE / GET LIST ---
const paginate = {
  query: Joi.object({
    search: Joi.string(),
    customer: Joi.string().custom(objectId),
    status: Joi.string().valid('pending', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled'),
    paymentStatus: Joi.string().valid('pending', 'paid', 'failed'),
    shippingStatus: Joi.string().valid('pending', 'delivering', 'delivered', 'failed'),
    startDate: Joi.date(),
    endDate: Joi.date(),
    sortBy: Joi.string().allow('', null),
    limit: Joi.number().integer().min(1).default(10),
    page: Joi.number().integer().min(1).default(1),
    populate: Joi.string().allow('', null),
  }),
};

// --- FIND BY ID ---
const findById = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
};

// --- UPDATE BY ID ---
const updateById = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object({
    customer: Joi.string().custom(objectId),
    items: Joi.array().items(orderItemSchema),
    totalAmount: Joi.number(),
    discountAmount: Joi.number(),
    shippingFee: Joi.number(),
    grandTotal: Joi.number(),
    payment: paymentSchema,
    shipping: shippingSchema,
    status: Joi.string().valid('pending', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled'),
    note: Joi.string().allow('', null),
    createdBy: Joi.string().custom(objectId),
  }).min(1),
};

// --- DELETE BY ID ---
const deleteById = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
};

// --- DELETE MANY BY IDS ---
const deleteManyById = {
  params: Joi.object({
    ids: Joi.string().required(),
  }),
};

module.exports = {
  create,
  paginate,
  findById,
  updateById,
  deleteById,
  deleteManyById,
};
