const Joi = require('joi');
const { password, objectId } = require('./custom.validation');

// --- Schema con ---
const roleRef = Joi.string().custom(objectId);
const permissionRef = Joi.string().custom(objectId);

// --- CREATE ---
const create = {
  body: Joi.object().keys({
    name: Joi.string().required().trim(),
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),

    role: Joi.string().required().valid('guest', 'staff', 'admin'),

    rolesCustom: Joi.array().items(roleRef),
    extraPermissions: Joi.array().items(permissionRef),
    excludePermissions: Joi.array().items(permissionRef),

    isEmailVerified: Joi.boolean().default(false),
  }),
};

// --- PAGINATE / GET LIST ---
const paginate = {
  query: Joi.object().keys({
    name: Joi.string(),
    search: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string().allow('', null), // optional: cho phép query populate
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
      name: Joi.string().trim(),
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      role: Joi.string().valid('guest', 'staff', 'admin'),

      rolesCustom: Joi.array().items(roleRef),
      extraPermissions: Joi.array().items(permissionRef),
      excludePermissions: Joi.array().items(permissionRef),

      isEmailVerified: Joi.boolean(),
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

const changePassword = {
  body: Joi.object().keys({
    password: Joi.string().custom(password).required(),
    newPassword: Joi.string().custom(password).required(),
  }),
};

module.exports = {
  create,
  paginate,
  findById,
  updateById,
  deleteById,
  deleteManyById,
  changePassword,
};
