const Joi = require('joi');
const { objectId } = require('./custom.validation');

// Định nghĩa cấu trúc lồng nhau dùng chung
const dealOptionConfig = Joi.object().keys({
  value: Joi.boolean().default(false),
  note: Joi.string().allow('', null).default(''),
  activeNote: Joi.boolean().default(false),
  showNoteWhen: Joi.string().valid('on', 'off', 'always').default('off'),
});

const create = {
  body: Joi.object().keys({
    // 🔥 BỔ SUNG 2 TRƯỜNG MỚI
    homeDelivery: dealOptionConfig,
    storePickup: dealOptionConfig,

    // Các trường cũ
    fastDelivery: dealOptionConfig,
    scheduledDelivery: dealOptionConfig,
    cashPayment: dealOptionConfig,
    bankTransfer: dealOptionConfig,

    flashSale: dealOptionConfig,
    combo: dealOptionConfig,
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
      // 🔥 BỔ SUNG KHI UPDATE
      homeDelivery: dealOptionConfig,
      storePickup: dealOptionConfig,

      fastDelivery: dealOptionConfig,
      scheduledDelivery: dealOptionConfig,
      cashPayment: dealOptionConfig,
      bankTransfer: dealOptionConfig,

      flashSale: dealOptionConfig,
      combo: dealOptionConfig,
    })
    .min(1),
};

module.exports = {
  create,
  paginate,
  updateById,
};
