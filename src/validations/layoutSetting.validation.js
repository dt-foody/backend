const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    headerNavItems: Joi.array()
      .items(
        Joi.object().keys({
          id: Joi.string().required(),
          title: Joi.string().required(),
          description: Joi.string().allow('').optional(),
          enable: Joi.boolean().optional(),
        })
      )
      .required(),
  }),
};

const paginate = {
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const updateById = {
  params: Joi.object().keys({
    id: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      headerNavItems: Joi.array().items(
        Joi.object().keys({
          id: Joi.string(),
          title: Joi.string(),
          description: Joi.string().allow('').optional(),
          enable: Joi.boolean().optional(),
        })
      ),
    })
    .min(1),
};

module.exports = {
  create,
  paginate,
  updateById,
};
