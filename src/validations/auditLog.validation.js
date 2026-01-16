const Joi = require('joi');
const { objectId } = require('./custom.validation');

const paginate = {
  query: Joi.object().keys({
    targetModel: Joi.string(),
    target: Joi.string().custom(objectId),
    action: Joi.string(),
    performer: Joi.string().custom(objectId),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string(),
  }),
};

const findById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

module.exports = {
  paginate,
  findById,
};
