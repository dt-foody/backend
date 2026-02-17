const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    priority: Joi.number().optional(),
    conditions: Joi.object().allow(null).optional(),
    fixedFee: Joi.number().required().min(0),
    isActive: Joi.boolean().optional(),
    description: Joi.string().allow('', null).optional(),
  }),
};

const paginate = {
  query: Joi.object().keys({
    name: Joi.string(),
    isActive: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
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
      priority: Joi.number(),
      conditions: Joi.object().allow(null),
      fixedFee: Joi.number().min(0),
      isActive: Joi.boolean(),
      description: Joi.string().allow('', null),
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
