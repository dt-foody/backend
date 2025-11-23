const Joi = require('joi');
const { objectId } = require('./custom.validation');

// --- Sub-schema cho address ---
const addressSchema = Joi.object({
  _id: Joi.string().allow('', null),
  label: Joi.string().allow('', null),
  recipientName: Joi.string().required().trim(),
  recipientPhone: Joi.string().required().trim(),
  street: Joi.string().required().trim(),
  ward: Joi.string().required().trim(),
  district: Joi.string().required().trim(),
  city: Joi.string().required().trim(),
  fullAddress: Joi.string().allow('', null),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array(), // .items(Joi.number()).length(2), // [lng, lat]
  }).optional(),
  isDefault: Joi.boolean().default(false),
});

// --- Sub-schema cho emails ---
const emailSchema = Joi.object({
  type: Joi.string().valid('Home', 'Company', 'Other').default('Other'),
  value: Joi.string().email().required().trim().lowercase(),
  isPrimary: Joi.boolean().default(false),
});

// --- Sub-schema cho phones ---
const phoneSchema = Joi.object({
  type: Joi.string().valid('Home', 'Company', 'Other').default('Other'),
  value: Joi.string().required().trim(),
  isPrimary: Joi.boolean().default(false),
});

// --- CREATE CUSTOMER ---
const create = {
  body: Joi.object({
    name: Joi.string().required().trim(),
    gender: Joi.string().valid('male', 'female', 'other').default('other'),
    birthDate: Joi.date().optional(),

    // thêm nhiều email & phone
    emails: Joi.array().items(emailSchema),
    phones: Joi.array().items(phoneSchema),

    addresses: Joi.array().items(addressSchema).optional(),
  }),
};

// --- PAGINATE / GET LIST ---
const paginate = {
  query: Joi.object({
    search: Joi.string(),
    name: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    email: Joi.string().email().trim(),
    phone: Joi.string().trim(),
    sortBy: Joi.string().allow('', null),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string().allow('', null),
  }),
};

// --- FIND BY ID ---
const findById = {
  params: Joi.object({
    id: Joi.string().required().custom(objectId),
  }),
};

// --- UPDATE BY ID ---
const updateById = {
  params: Joi.object({
    id: Joi.string().required().custom(objectId),
  }),
  body: Joi.object({
    name: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    birthDate: Joi.date(),
    emails: Joi.array().items(emailSchema),
    phones: Joi.array().items(phoneSchema),
    addresses: Joi.array().items(addressSchema),
  }).min(1),
};

// --- UPDATE PROFILE (client update cá nhân) ---
const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    birthDate: Joi.date(),
    emails: Joi.array().items(emailSchema),
    phones: Joi.array().items(phoneSchema),
    addresses: Joi.array().items(addressSchema),
  }).min(1),
};

// --- DELETE BY ID ---
const deleteById = {
  params: Joi.object({
    id: Joi.string().required().custom(objectId),
  }),
};

// --- DELETE MANY BY IDS ---
const deleteManyById = {
  params: Joi.object({
    ids: Joi.string().required(), // ví dụ: "id1,id2,id3"
  }),
};

module.exports = {
  create,
  paginate,
  findById,
  updateById,
  deleteById,
  deleteManyById,
  updateProfile,
};
