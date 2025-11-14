const Joi = require("joi");
const { objectId } = require("./custom.validation");

/* ============================================================
 * 1️⃣ SUB-SCHEMA: OPTIONS của PRODUCT
 * ============================================================*/
const frontendOptionItemSchema = Joi.object({
  name: Joi.string().required(),
  priceModifier: Joi.number().min(0).default(0),
});

const frontendOptionsSchema = Joi.object().pattern(
  Joi.string(), // groupName: "Size" / "Topping"...
  Joi.array().items(frontendOptionItemSchema)
);

/* ============================================================
 * 2️⃣ SUB-SCHEMA: LỰA CHỌN BÊN TRONG COMBO
 * ============================================================*/
const frontendComboSelectionSchema = Joi.object({
  slotName: Joi.string().required(),
  product: Joi.object({
    id: Joi.string().custom(objectId).required(),
    name: Joi.string().required(),
    basePrice: Joi.number().min(0).required(),
  }).required(),
  options: frontendOptionsSchema.default({}),
});

/* ============================================================
 * 3️⃣ SUB-SCHEMA: ORDER ITEM (Product hoặc Combo)
 * ============================================================*/
const createOrderItemSchema = Joi.object({
  item: Joi.object({
    id: Joi.string().custom(objectId).required(),
    name: Joi.string().required(),
    basePrice: Joi.number().min(0),
    comboPrice: Joi.number().min(0),
  })
    .required()
    .unknown(true),

  itemType: Joi.string().valid("Product", "Combo").required(),
  quantity: Joi.number().integer().min(1).required(),
  totalPrice: Joi.number().min(0).required(),
  note: Joi.string().allow("", null).default(""),

  // Cho phép FE gửi cartId nhưng BE không dùng
  cartId: Joi.string().optional().allow(null, ""),

  // OPTIONS
  options: Joi.when("itemType", {
    is: "Product",
    then: frontendOptionsSchema.required(),
    otherwise: Joi.forbidden(),
  }),

  // COMBO SELECTIONS
  comboSelections: Joi.when("itemType", {
    is: "Combo",
    then: Joi.array().items(frontendComboSelectionSchema).min(1).required(),
    otherwise: Joi.allow(null), // ❗ sửa tại đây
  }),
});


/* ============================================================
 * 4️⃣ SUB-SCHEMA: PAYMENT + COUPON + SHIPPING
 * ============================================================*/
const paymentSchema = Joi.object({
  method: Joi.string()
    .valid("cash", "payos", "momo", "vnpay", "bank_transfer")
    .default("cash"),
  status: Joi.string()
    .valid("pending", "paid", "failed", "refunded")
    .default("pending"),
  transactionId: Joi.string().allow("", null).default(""),
  checkoutUrl: Joi.string().allow("", null).default(""),
});

const appliedCouponSchema = Joi.object({
  id: Joi.string().custom(objectId).required(),
  code: Joi.string().required(),
});

const shippingSchema = Joi.object({
  address: Joi.object({
    label: Joi.string().allow("", null),
    recipientName: Joi.string().required(),
    recipientPhone: Joi.string().required(),
    street: Joi.string().required(),
    ward: Joi.string().required(),
    district: Joi.string().required(),
    city: Joi.string().required(),
  }).required(),
  status: Joi.string()
    .valid(
      "pending",
      "preparing",
      "delivering",
      "delivered",
      "failed",
      "canceled"
    )
    .default("pending"),
});

/* ============================================================
 * 5️⃣ VALIDATION: CREATE ORDER (POS / ADMIN)
 * ============================================================*/
const create = {
  body: Joi.object({
    profile: Joi.string().custom(objectId).allow(null).default(null),

    profileType: Joi.string()
      .valid("Customer", "Employee")
      .when("profile", {
        is: Joi.exist().not(null),
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      }),

    items: Joi.array().items(createOrderItemSchema).min(1).required(),

    appliedCoupons: Joi.array().items(appliedCouponSchema).default([]),

    totalAmount: Joi.number().min(0).required(),
    discountAmount: Joi.number().min(0).default(0),
    shippingFee: Joi.number().min(0).default(0),
    grandTotal: Joi.number().min(0).required(),

    payment: paymentSchema.default({
      method: "cash",
      status: "pending",
    }),

    shipping: shippingSchema.allow(null),

    status: Joi.string()
      .valid(
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "delivering",
        "completed",
        "canceled",
        "refunded"
      )
      .default("pending"),

    note: Joi.string().allow("", null).default(""),
    createdBy: Joi.string().custom(objectId).allow(null),
  }),
};

/* ============================================================
 * 6️⃣ VALIDATION: CUSTOMER ORDER (User FE)
 * ============================================================*/
const customerOrder = {
  body: Joi.object({
    items: Joi.array().items(createOrderItemSchema).min(1).required(),

    appliedCoupons: Joi.array().items(appliedCouponSchema).default([]),

    totalAmount: Joi.number().min(0).required(),
    discountAmount: Joi.number().min(0).default(0),
    shippingFee: Joi.number().min(0).default(0),
    grandTotal: Joi.number().min(0).required(),

    payment: paymentSchema.required(),
    shipping: shippingSchema.allow(null),

    note: Joi.string().allow("", null).default(""),
  }),
};

/* ============================================================
 * 7️⃣ VALIDATION: PAGINATION
 * ============================================================*/
const paginateOrders = {
  query: Joi.object({
    search: Joi.string().allow("", null),
    orderId: Joi.number().integer(),
    profile: Joi.string().custom(objectId),
    status: Joi.string().valid(
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivering",
      "completed",
      "canceled",
      "refunded"
    ),
    paymentStatus: Joi.string().valid(
      "pending",
      "paid",
      "failed",
      "refunded"
    ),
    shippingStatus: Joi.string().valid(
      "pending",
      "preparing",
      "delivering",
      "delivered",
      "failed",
      "canceled"
    ),
    startDate: Joi.date(),
    endDate: Joi.date(),
    sortBy: Joi.string().allow("", null),
    limit: Joi.number().min(1).default(10),
    page: Joi.number().min(1).default(1),
    populate: Joi.string().allow("", null),
  }),
};

/* ============================================================
 * 8️⃣ VALIDATION: FIND & GET ORDER
 * ============================================================*/
const findById = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
};

const getByOrderId = {
  params: Joi.object({
    orderId: Joi.number().integer().min(1).required(),
  }),
};

/* ============================================================
 * 9️⃣ VALIDATION: UPDATE ORDER
 * ============================================================*/
const updateById = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),

  body: Joi.object({
    status: Joi.string().valid(
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivering",
      "completed",
      "canceled",
      "refunded"
    ),

    "payment.status": Joi.string().valid(
      "pending",
      "paid",
      "failed",
      "refunded"
    ),

    "shipping.status": Joi.string().valid(
      "pending",
      "preparing",
      "delivering",
      "delivered",
      "failed",
      "canceled"
    ),

    payment: paymentSchema,
    shipping: shippingSchema.allow(null),
    note: Joi.string().allow("", null),

    discountAmount: Joi.number().min(0),
    shippingFee: Joi.number().min(0),
  }).min(1),
};

/* ============================================================
 * 🔟 VALIDATION: DELETE
 * ============================================================*/
const deleteById = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
};

const deleteMany = {
  body: Joi.object({
    ids: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
  }),
};

/* ============================================================
 * EXPORT
 * ============================================================*/
module.exports = {
  create,
  customerOrder,
  paginate: paginateOrders,
  findById,
  getByOrderId,
  updateById,
  deleteById,
  deleteMany,
};
