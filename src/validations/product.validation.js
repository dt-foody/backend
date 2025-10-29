const Joi = require('joi');
const { objectId } = require('./custom.validation.js');

// --- Schema con: Product Option ---
const productOption = Joi.object({
  name: Joi.string().required(),
  priceModifier: Joi.number().required().default(0),
  type: Joi.string().valid('fixed_amount', 'percentage').default('fixed_amount'),
  isActive: Joi.boolean().default(true),
  priority: Joi.number().integer().default(0),
});

// --- Schema con: Product Option Group ---
const productOptionGroup = Joi.object({
  name: Joi.string().required(),
  minOptions: Joi.number().integer().default(0),
  maxOptions: Joi.number().integer().default(1),
  priority: Joi.number().integer().default(0),
  options: Joi.array().items(productOption),
});

// --- CREATE ---
const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    basePrice: Joi.number().min(0).required(),
    category: Joi.string().required().custom(objectId),
    thumbnailUrl: Joi.string().allow('', null),
    isActive: Joi.boolean(),
    priority: Joi.number().integer(),
    optionGroups: Joi.array().items(productOptionGroup),
  }),
};

// --- PAGINATE / GET LIST ---
const paginate = {
  query: Joi.object().keys({
    search: Joi.string().allow('', null),
    category: Joi.string().custom(objectId),
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
      basePrice: Joi.number().min(0),
      category: Joi.string().custom(objectId),
      thumbnailUrl: Joi.string().allow('', null),
      isActive: Joi.boolean(),
      priority: Joi.number().integer(),
      optionGroups: Joi.array().items(productOptionGroup),
      isDeleted: Joi.boolean(),
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
    ids: Joi.string()
      .custom((value, helpers) => {
        const ids = value.split(',').map((id) => id.trim());
        for (const id of ids) {
          if (!objectId.isValid(id)) {
            return helpers.message(`Invalid ID: ${id}`);
          }
        }
        return value;
      })
      .required(),
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
