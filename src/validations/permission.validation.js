const Joi = require('joi');
const { objectId } = require('./custom.validation.js');

// --- CREATE ---
const create = {
  body: Joi.object().keys({
    resource: Joi.string().required().trim(),  // VD: 'product'
    action: Joi.string().required().trim(),    // VD: 'create'
    name: Joi.string().trim().allow('', null), // VD: 'product.create' (auto gen nếu rỗng)
    description: Joi.string().allow('', null).default(''),
  }),
};

// --- PAGINATE / GET LIST ---
const paginate = {
  query: Joi.object().keys({
    resource: Joi.string(),
    action: Joi.string(),
    name: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string().allow('', null),
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
      resource: Joi.string().trim(),
      action: Joi.string().trim(),
      name: Joi.string().trim(),
      description: Joi.string().allow('', null),
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
