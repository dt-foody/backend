const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    cost: Joi.number().required().min(0),
    description: Joi.string().allow('', null),
    isActive: Joi.boolean(),
    priority: Joi.number().integer(),
  }),
};

const paginate = {
  query: Joi.object().keys({
    name: Joi.string(),
    isActive: Joi.boolean(),
    search: Joi.string().allow('', null),
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
      cost: Joi.number().min(0),
      description: Joi.string().allow('', null),
      isActive: Joi.boolean(),
      priority: Joi.number().integer(),
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
