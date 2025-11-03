const Joi = require('joi');
const { objectId } = require('./custom.validation');

// --- Sub-schema: Sản phẩm có thể chọn trong 1 vị trí combo ---
const selectableProduct = Joi.object({
  product: Joi.string().required().custom(objectId),
  fixedPrice: Joi.number().min(0).required(),
  maxQuantity: Joi.number().integer().min(1).default(1),
});

// --- Sub-schema: Thành phần (slot) trong combo ---
const comboItem = Joi.object({
  slotName: Joi.string().required(),
  selectableProducts: Joi.array().items(selectableProduct).min(1).required(),
  isRequired: Joi.boolean().default(true),
});

// --- CREATE ---
const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    comboPrice: Joi.number().min(0).required(),
    thumbnailUrl: Joi.string().allow('', null),
    startDate: Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref('startDate')).required(),
    items: Joi.array().items(comboItem).min(1).required(),
    isActive: Joi.boolean(),
    priority: Joi.number().integer(),
  }),
};

// --- PAGINATE (GET LIST) ---
const paginate = {
  query: Joi.object().keys({
    search: Joi.string(),
    name: Joi.string(),
    isActive: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string().allow('', null),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
  }),
};

// --- FIND BY ID ---
const findById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

// --- UPDATE BY ID ---
const updateById = {
  params: Joi.object().keys({
    id: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      comboPrice: Joi.number().min(0),
      thumbnailUrl: Joi.string().allow('', null),
      startDate: Joi.date(),
      endDate: Joi.date().greater(Joi.ref('startDate')),
      items: Joi.array().items(comboItem),
      isActive: Joi.boolean(),
      priority: Joi.number().integer(),
    })
    .min(1),
};

// --- DELETE BY ID ---
const deleteById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

// --- DELETE MANY BY IDS ---
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
