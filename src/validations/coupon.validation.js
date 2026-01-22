// coupon.validation
const Joi = require('joi');
const { objectId } = require('./custom.validation');

const create = {
  body: Joi.object()
    .keys({
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      code: Joi.string().allow('', null),

      type: Joi.string().valid('discount_code', 'freeship', 'referral').default('discount_code'),
      value: Joi.number().min(0).required(),
      valueType: Joi.string().valid('fixed_amount', 'percentage', 'gift_item').default('fixed_amount'),
      maxDiscountAmount: Joi.number().min(0).default(0),
      minOrderAmount: Joi.number().min(0).default(0),

      giftItems: Joi.array()
        .items(
          Joi.object().keys({
            item: Joi.string().required(), // ID sản phẩm/combo
            itemType: Joi.string().required().valid('Product', 'Combo'),
            name: Joi.string().allow('', null).default(''),
            price: Joi.number().min(0).required(),
          })
        )
        .when('valueType', {
          is: 'gift_item',
          then: Joi.array().min(1).required(), // Nếu là gift_item thì BẮT BUỘC phải có ít nhất 1 món
          otherwise: Joi.array().default([]), // Các trường hợp khác thì cho phép rỗng
        }),

      startDate: Joi.date().required(),
      endDate: Joi.date().required(),

      maxUses: Joi.number().min(0).default(0),
      usedCount: Joi.number().min(0).default(0),
      maxUsesPerUser: Joi.number().min(0).default(0),

      public: Joi.boolean().default(true),
      claimable: Joi.boolean().default(false),
      autoApply: Joi.boolean().default(false),
      stackable: Joi.boolean().default(false),

      conditions: Joi.object().allow(null),
      status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED').default('ACTIVE'),

      createdBy: Joi.string().custom(objectId),
    })
    .when(Joi.object({ valueType: Joi.string().valid('percentage') }).unknown(), {
      then: Joi.object({
        maxDiscountAmount: Joi.number().min(0).required(),
      }),
    }),
};

const paginate = {
  query: Joi.object().keys({
    search: Joi.string(),
    status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED'),
    public: Joi.boolean(),
    page: Joi.number().integer(),
    limit: Joi.number().integer(),
    sortBy: Joi.string(),
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
      code: Joi.string().allow('', null),
      type: Joi.string().valid('discount_code', 'freeship', 'referral'),
      value: Joi.number().min(0),
      valueType: Joi.string().valid('fixed_amount', 'percentage', 'gift_item'),
      maxDiscountAmount: Joi.number().min(0),
      minOrderAmount: Joi.number().min(0),

      giftItems: Joi.array().items(
        Joi.object().keys({
          item: Joi.string().required(),
          itemType: Joi.string().required().valid('Product', 'Combo'),
          name: Joi.string().allow('', null).default(''),
          price: Joi.number().min(0).required(),
        })
      ),

      startDate: Joi.date(),
      endDate: Joi.date(),

      maxUses: Joi.number().min(0),
      usedCount: Joi.number().min(0),
      maxUsesPerUser: Joi.number().min(0),

      public: Joi.boolean(),
      claimable: Joi.boolean(),
      autoApply: Joi.boolean(),
      stackable: Joi.boolean(),

      conditions: Joi.object().allow(null),
      status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED'),

      createdBy: Joi.string().custom(objectId),
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
