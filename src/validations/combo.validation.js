const Joi = require('joi');
const { objectId } = require('./custom.validation');

// MỚI: Định nghĩa các giá trị hợp lệ
const pricingModes = ['FIXED', 'SLOT_PRICE', 'DISCOUNT'];
const discountTypes = ['PERCENT', 'AMOUNT', 'NONE'];

// --- Sub-schema: Sản phẩm có thể chọn (CẬP NHẬT) ---
const selectableProduct = Joi.object({
  product: Joi.string().required().custom(objectId),
  snapshotPrice: Joi.number().min(0).required(),
  additionalPrice: Joi.number().min(0).default(0),
  slotPrice: Joi.number().min(0).default(0),
});

// --- Sub-schema: Thành phần (slot) trong combo (CẬP NHẬT) ---
const comboItem = Joi.object({
  slotName: Joi.string().required(),
  selectableProducts: Joi.array().items(selectableProduct).min(1).required(),
  minSelection: Joi.number().integer().min(0).default(1),
  maxSelection: Joi.number().integer().min(Joi.ref('minSelection')).default(1),
});

// --- CREATE (CẬP NHẬT) ---
const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    image: Joi.string().allow('', null),
    startDate: Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref('startDate')).required(),
    items: Joi.array().items(comboItem).min(1).required(),
    isActive: Joi.boolean(),
    priority: Joi.number().integer(),

    // --- CÁC TRƯỜNG ĐÃ REFACTOR ---
    pricingMode: Joi.string()
      .valid(...pricingModes)
      .default('FIXED'),
    comboPrice: Joi.number().min(0).default(0),
    
    discountType: Joi.string()
      .valid(...discountTypes)
      .default('NONE'),
    discountValue: Joi.number().min(0).default(0),
    
    /** BỎ: discountAmount, discountPercent, và .nand() */
  }),
};

// --- PAGINATE (GET LIST) ---
const paginate = {
  query: Joi.object().keys({
    search: Joi.string(),
    name: Joi.string(),
    isActive: Joi.boolean(),
    pricingMode: Joi.string().valid(...pricingModes),
    discountType: Joi.string().valid(...discountTypes), // MỚI
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string().allow('', null),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
  }),
};

// --- FIND BY ID ---
// (Không thay đổi)
const findById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

// --- UPDATE BY ID (CẬP NHẬT) ---
const updateById = {
  params: Joi.object().keys({
    id: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      image: Joi.string().allow('', null),
      startDate: Joi.date(),
      endDate: Joi.date().greater(Joi.ref('startDate')),
      items: Joi.array().items(comboItem),
      isActive: Joi.boolean(),
      priority: Joi.number().integer(),

      // --- CÁC TRƯỜNG ĐÃ REFACTOR ---
      pricingMode: Joi.string().valid(...pricingModes),
      comboPrice: Joi.number().min(0),
      discountType: Joi.string().valid(...discountTypes),
      discountValue: Joi.number().min(0),
    })
    .min(1),
};

// --- DELETE BY ID ---
// (Không thay đổi)
const deleteById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

// --- DELETE MANY BY IDS ---
// (Không thay đổi)
const deleteManyById = {
  params: Joi.object().keys({
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
