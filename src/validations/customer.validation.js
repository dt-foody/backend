const Joi = require('joi');
const { objectId, password } = require('./custom.validation');

// --- Schema con ---
const addressSchema = Joi.object().keys({
  label: Joi.string().allow('', null),
  recipientName: Joi.string().required().trim(),
  recipientPhone: Joi.string().required().trim(),
  street: Joi.string().required().trim(),
  ward: Joi.string().required().trim(),
  district: Joi.string().required().trim(),
  city: Joi.string().required().trim(),
  fullAddress: Joi.string().allow('', null),
  location: Joi.object()
    .keys({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().length(2).items(Joi.number()).required(), // [lng, lat]
    })
    .optional(),
  isDefault: Joi.boolean().default(false),
});

// --- CREATE CUSTOMER ---
const create = {
  body: Joi.object().keys({
    email: Joi.string().required().email().trim().lowercase(),
    name: Joi.string().required().trim(),
    phone: Joi.string().required().trim(),
    gender: Joi.string().valid('male', 'female', 'other').default('other'),
    birthDate: Joi.date().optional(),
    addresses: Joi.array().items(addressSchema),
    isActive: Joi.boolean().default(true),
  }),
};

// --- PAGINATE / GET LIST ---
const paginate = {
  query: Joi.object().keys({
    search: Joi.string(),
    name: Joi.string().trim(),
    email: Joi.string().email().trim(),
    phone: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    sortBy: Joi.string().allow('', null),
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
    id: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email().trim().lowercase(),
      name: Joi.string().trim(),
      phone: Joi.string().trim(),
      gender: Joi.string().valid('male', 'female', 'other'),
      birthDate: Joi.date(),
      addresses: Joi.array().items(addressSchema),
      isActive: Joi.boolean(),
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
