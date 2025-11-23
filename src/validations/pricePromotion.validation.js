const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    product: Joi.string().custom(objectId).allow(null),
    combo: Joi.string().custom(objectId).allow(null),
    discountType: Joi.string().valid('percentage', 'fixed_amount').required(),
    discountValue: Joi.number().min(0).required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    maxQuantity: Joi.number().min(0).default(0),
    dailyMaxUses: Joi.number().min(0).default(0),
    isActive: Joi.boolean().default(true),
  }),
};

const paginate = {
  query: Joi.object().keys({
    name: Joi.string(),
    search: Joi.string(),
    populate: Joi.string().allow('', null),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    isActive: Joi.boolean(),
  }),
};

const findById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

const updateById = {
  params: Joi.object().keys({
    id: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      product: Joi.string().custom(objectId).allow(null),
      combo: Joi.string().custom(objectId).allow(null),
      discountType: Joi.string().valid('percentage', 'fixed_amount'),
      discountValue: Joi.number().min(0),
      startDate: Joi.date(),
      endDate: Joi.date(),
      maxQuantity: Joi.number().min(0),
      dailyMaxUses: Joi.number().min(0),
      isActive: Joi.boolean(),
      isDeleted: Joi.boolean(),
    })
    .min(1),
};

const deleteById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

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
