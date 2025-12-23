const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object().keys({
    allowFastDelivery: Joi.boolean(),
    allowScheduledDelivery: Joi.boolean(),
    allowCashPayment: Joi.boolean(),
    allowBankTransfer: Joi.boolean(),
  }),
};

const paginate = {
  query: Joi.object().keys({
    search: Joi.string(),
    populate: Joi.string().allow('', null),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const updateById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      allowFastDelivery: Joi.boolean(),
      allowScheduledDelivery: Joi.boolean(),
      allowCashPayment: Joi.boolean(),
      allowBankTransfer: Joi.boolean(),
    })
    .min(1),
};

module.exports = {
  create,
  paginate,
  updateById,
};
