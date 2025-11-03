const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    image: Joi.string().allow('', null),
    isActive: Joi.boolean(),
    priority: Joi.number().integer(),
    parent: Joi.string().custom(objectId).allow(null),
  }),
};

const paginate = {
  query: Joi.object().keys({
    name: Joi.string(),
    search: Joi.string().allow('', null),
    populate: Joi.string().allow(null, ''),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    level: Joi.number().integer().valid(1, 2, 3).allow(null),
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
      image: Joi.string().allow('', null),
      isActive: Joi.boolean(),
      priority: Joi.number().integer(),
      parent: Joi.string().custom(objectId).allow(null),
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
