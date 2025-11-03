const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    backgroundColor: Joi.string().allow(null, '').default('#E0E0E0'),
    textColor: Joi.string().allow(null, '').default('#212121'),
    isActive: Joi.boolean(),
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
      backgroundColor: Joi.string().allow(null, '').default('#E0E0E0'),
      textColor: Joi.string().allow(null, '').default('#212121'),
      isActive: Joi.boolean(),
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
