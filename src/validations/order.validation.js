// dt-foody/backend/.../src/validations/order.validation.js

const Joi = require('joi');
const { objectId } = require('./custom.validation');

/* ============================================================
 * 1️⃣ SUB-SCHEMA: OPTIONS & PRODUCTS
 * ============================================================ */
const frontendOptionItemSchema = Joi.object({
  name: Joi.string().required(),
  priceModifier: Joi.number().min(0).default(0),
});

const frontendOptionsSchema = Joi.object().pattern(Joi.string(), Joi.array().items(frontendOptionItemSchema));

const frontendComboSelectionSchema = Joi.object({
  slotName: Joi.string().required(),
  product: Joi.object({
    id: Joi.string().custom(objectId).required(),
    name: Joi.string().required(),
    basePrice: Joi.number().min(0).required(),
  }).required(),
  additionalPrice: Joi.number().default(0),
  itemPrice: Joi.number().default(0),
  options: frontendOptionsSchema.default({}),
});

const createOrderItemSchema = Joi.object({
  item: Joi.object({
    id: Joi.string().custom(objectId).required(),
    name: Joi.string().required(),
    basePrice: Joi.number().min(0),
    comboPrice: Joi.number().min(0),
    salePrice: Joi.number().min(0),
    promotion: Joi.string().allow(null, ''),
  })
    .required()
    .unknown(true),

  itemType: Joi.string().valid('Product', 'Combo').required(),
  quantity: Joi.number().integer().min(1).required(),
  totalPrice: Joi.number().min(0).required(),
  note: Joi.string().allow('', null).default(''),
  cartId: Joi.string().optional().allow(null, ''),

  options: Joi.when('itemType', {
    is: 'Product',
    then: frontendOptionsSchema.required(),
    otherwise: Joi.allow(null),
  }),

  comboSelections: Joi.when('itemType', {
    is: 'Combo',
    then: Joi.array().items(frontendComboSelectionSchema).min(1).required(),
    otherwise: Joi.allow(null),
  }),

  comboSnapshot: Joi.any().strip(),
});

/* ============================================================
 * 2️⃣ SUB-SCHEMA: PAYMENT, SHIPPING, DELIVERY
 * ============================================================ */
const paymentSchema = Joi.object({
  method: Joi.string().valid('cash', 'payos', 'momo', 'vnpay', 'bank_transfer').default('cash'),
  status: Joi.string().valid('pending', 'paid', 'failed', 'refunded', 'canceled').default('pending'),
  transactionId: Joi.string().allow('', null).default(''),
  checkoutUrl: Joi.string().allow('', null).default(''),
  qrCode: Joi.string().allow('', null).default(''), // Bổ sung cho PayOS nếu cần
  message: Joi.string().allow('', null).default(''),
});

// 🔥 STRICT SHIPPING SCHEMA (Dùng cho Delivery)
const deliveryShippingSchema = Joi.object({
  address: Joi.object({
    _id: Joi.string().allow(null, ''),
    isDefault: Joi.boolean().default(true),
    label: Joi.string().allow('', null),
    recipientName: Joi.string().required(),
    recipientPhone: Joi.string().required(),

    // Các trường địa chỉ bắt buộc khi Ship
    fullAddress: Joi.string().required(),
    street: Joi.string().required(),
    ward: Joi.string().required(),
    district: Joi.string().required(),
    city: Joi.string().required(),

    location: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array(),
    }).optional(),
  }).required(),
  status: Joi.string().valid('pending', 'preparing', 'delivering', 'delivered', 'failed', 'canceled').default('pending'),
});

// 🔥 LOOSE SHIPPING SCHEMA (Dùng cho TakeAway / DineIn)
const looseShippingSchema = Joi.object({
  address: Joi.object().allow(null, {}).unknown(true), // Cho phép object rỗng hoặc null
  status: Joi.string().default('pending'),
});

const deliveryTimeSchema = Joi.object({
  option: Joi.string().valid('immediate', 'scheduled').default('immediate'),
  scheduledAt: Joi.date()
    .iso()
    .allow(null)
    .when('option', {
      is: 'scheduled',
      then: Joi.required(),
      otherwise: Joi.allow(null),
    }),
  timeSlot: Joi.string()
    .allow(null)
    .when('option', {
      is: 'scheduled',
      then: Joi.required(),
      otherwise: Joi.allow(null),
    }),
});

/* ============================================================
 * 3️⃣ SUB-SCHEMA: COUPON & VOUCHER
 * ============================================================ */
const couponInputSchema = Joi.object({
  id: Joi.string().custom(objectId).required(),
  code: Joi.string().required(),
});

const voucherInputSchema = Joi.object({
  voucherId: Joi.string().custom(objectId).required(),
  voucherCode: Joi.string().required(),
});

/* ============================================================
 * 4️⃣ MAIN VALIDATION SCHEMAS
 * ============================================================ */

// A. CUSTOMER ORDER (FE)
const customerOrder = {
  body: Joi.object({
    items: Joi.array().items(createOrderItemSchema).min(1).required(),

    coupons: Joi.array().items(couponInputSchema).default([]),
    vouchers: Joi.array().items(voucherInputSchema).default([]),

    totalAmount: Joi.number().min(0).required(),
    discountAmount: Joi.number().min(0).default(0),
    shippingFee: Joi.number().min(0).default(0),
    surchargeAmount: Joi.number().min(0).default(0),
    grandTotal: Joi.number().min(0).required(),

    payment: paymentSchema.required(),
    deliveryTime: deliveryTimeSchema.optional(),

    note: Joi.string().allow('', null).default(''),

    // 🔥 Định nghĩa rõ các loại Order
    orderType: Joi.string().valid('Delivery', 'TakeAway', 'DineIn').default('Delivery'),
    channel: Joi.string().allow('', null).default('WebApp'),

    // 🔥 LOGIC QUAN TRỌNG: Điều kiện Shipping dựa trên OrderType
    shipping: Joi.when('orderType', {
      is: 'TakeAway',
      then: looseShippingSchema.allow(null), // Nếu TakeAway: Validate lỏng lẻo
      otherwise: deliveryShippingSchema.required(), // Nếu Delivery: Validate chặt (bắt buộc địa chỉ)
    }),
  }),
};

// B. ADMIN CREATE ORDER
const create = {
  body: Joi.object({
    profile: Joi.string().custom(objectId).allow(null).default(null),
    profileType: Joi.string()
      .valid('Customer', 'Employee', null)
      .when('profile', {
        is: Joi.exist().not(null),
        then: Joi.required(),
        otherwise: Joi.strip(),
      }),

    items: Joi.array().items(createOrderItemSchema).min(1).required(),

    coupons: Joi.array().items(couponInputSchema).default([]),
    vouchers: Joi.array().items(voucherInputSchema).default([]),

    totalAmount: Joi.number().min(0).required(),
    discountAmount: Joi.number().min(0).default(0),
    shippingFee: Joi.number().min(0).default(0),
    surchargeAmount: Joi.number().min(0).default(0),
    grandTotal: Joi.number().min(0).required(),

    payment: paymentSchema.default({ method: 'cash', status: 'pending' }),
    deliveryTime: deliveryTimeSchema.optional(),

    status: Joi.string().default('pending'),
    note: Joi.string().allow('', null),
    createdBy: Joi.string().custom(objectId).allow(null),

    orderType: Joi.string().valid('Delivery', 'TakeAway', 'DineIn').default('Delivery'),
    channel: Joi.string().allow('', null),

    // Áp dụng logic tương tự cho Admin
    shipping: Joi.when('orderType', {
      is: 'TakeAway',
      then: looseShippingSchema.allow(null),
      otherwise: deliveryShippingSchema.allow(null), // Admin có thể tạo đơn nháp chưa có địa chỉ, nhưng nếu có thì phải đúng
    }),
  }),
};

// C. ADMIN UPDATE ORDER
const adminPanelUpdateOrder = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),

  body: Joi.object({
    profile: Joi.string().custom(objectId).allow(null),
    profileType: Joi.string().valid('Customer', 'Employee').allow(null),
    status: Joi.string(),

    items: Joi.array().items(createOrderItemSchema).min(1),

    coupons: Joi.array().items(couponInputSchema),
    vouchers: Joi.array().items(voucherInputSchema),

    discountAmount: Joi.number().min(0),
    shippingFee: Joi.number().min(0),
    surchargeAmount: Joi.number().min(0),

    payment: paymentSchema,
    shipping: Joi.object().unknown(true).allow(null), // Khi update cho phép linh hoạt hơn
    deliveryTime: deliveryTimeSchema,

    note: Joi.string().allow('', null),
    orderType: Joi.string().allow('', null),
    channel: Joi.string().allow('', null),
  }).min(1),
};

// D. OTHER SCHEMAS
const paginateOrders = {
  query: Joi.object({
    search: Joi.string().allow('', null),
    orderId: Joi.number().integer(),
    profile: Joi.string().custom(objectId),
    status: Joi.string(),
    paymentStatus: Joi.string(),
    shippingStatus: Joi.string(),
    deliveryType: Joi.string(),
    orderType: Joi.string(), // Thêm filter theo type
    startDate: Joi.date(),
    endDate: Joi.date(),
    sortBy: Joi.string(),
    limit: Joi.number().min(1).default(10),
    page: Joi.number().min(1).default(1),
    populate: Joi.string(),
    deliveryFrom: Joi.date().iso(),
    deliveryTo: Joi.date().iso(),
  }),
};

const findById = { params: Joi.object({ id: Joi.string().custom(objectId).required() }) };
const getByOrderId = { params: Joi.object({ orderId: Joi.number().integer().min(1).required() }) };
const deleteById = { params: Joi.object({ id: Joi.string().custom(objectId).required() }) };
const deleteMany = { body: Joi.object({ ids: Joi.array().items(Joi.string().custom(objectId)).min(1).required() }) };
const getShippingFee = {
  body: Joi.object().keys({
    lat: Joi.number().required().min(-90).max(90),
    lng: Joi.number().required().min(-180).max(180),
    orderTime: Joi.date().iso().optional(),
    items: Joi.array()
      .items(
        Joi.object({
          quantity: Joi.number().integer().min(1).required(),
          price: Joi.number().min(0),
        }).unknown(true)
      )
      .optional(),
    totalAmount: Joi.number().min(0).optional(),
  }),
};

module.exports = {
  create,
  customerOrder,
  adminPanelCreateOrder: create,
  adminPanelUpdateOrder,
  paginate: paginateOrders,
  findById,
  getByOrderId,
  deleteById,
  deleteMany,
  getShippingFee,
};
