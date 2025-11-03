const Joi = require('joi');
const mongoose = require('mongoose');
const { objectId } = require('./custom.validation');

// Sub-schema cho discountSnapshot (dựa trên model)
const discountSnapshotSchema = Joi.object({
  type: Joi.string().valid('fixed', 'percentage').required(),
  value: Joi.number().min(0).required(),
  maxDiscount: Joi.number().min(0).default(0),
}).required();

const create = {
  body: Joi.object().keys({
    customer: Joi.string().custom(objectId).required(),
    coupon: Joi.string().custom(objectId).required(),
    code: Joi.string().required(), // Admin hoặc hệ thống phải tạo code khi cấp phát

    issueMode: Joi.string().valid('CLAIM', 'ADMIN', 'AUTO', 'REFERRAL').default('ADMIN'),
    status: Joi.string().valid('UNUSED', 'USED', 'EXPIRED', 'REVOKED').default('UNUSED'),

    expiredAt: Joi.date().required(), // Ngày hết hạn là bắt buộc khi tạo
    usageLimit: Joi.number().min(1).default(1),

    // Snapshot là bắt buộc khi tạo voucher
    discountSnapshot: discountSnapshotSchema,

    // orderId, usedAt, revokeAt... sẽ được cập nhật sau
  }),
};

const paginate = {
  query: Joi.object().keys({
    search: Joi.string().allow('', null), // Dùng để search `code`
    populate: Joi.string().allow('', null),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),

    // --- Filters ---
    customer: Joi.string().custom(objectId),
    coupon: Joi.string().custom(objectId),
    order: Joi.string().custom(objectId),
    status: Joi.string().valid('UNUSED', 'USED', 'EXPIRED', 'REVOKED'),
    issueMode: Joi.string().valid('CLAIM', 'ADMIN', 'AUTO', 'REFERRAL'),
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
      // Các trường này hiếm khi update, nhưng vẫn cho phép
      customer: Joi.string().custom(objectId),
      coupon: Joi.string().custom(objectId),
      order: Joi.string().custom(objectId).allow(null),
      code: Joi.string(),

      // Các trường thường update
      status: Joi.string().valid('UNUSED', 'USED', 'EXPIRED', 'REVOKED'),
      expiredAt: Joi.date(),
      usageLimit: Joi.number().min(0),

      // Không nên cho phép update snapshot, nhưng nếu cần:
      // discountSnapshot: Joi.object({
      //   type: Joi.string().valid('fixed', 'percentage'),
      //   value: Joi.number().min(0),
      //   maxDiscount: Joi.number().min(0),
      // }),
    })
    .min(1),
};

const deleteById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

// const deleteManyById = {
//   body: Joi.object().keys({
//     ids: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
//   }),
// };

// Hoặc nếu bạn muốn giữ nguyên logic `params` cho deleteManyById
const deleteManyById = {
  params: Joi.object().keys({
    ids: Joi.string()
      .custom((value, helpers) => {
        const ids = value.split(',').map((id) => id.trim());
        const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
          return helpers.message(`One or more IDs are invalid: ${invalidIds.join(', ')}`);
        }
        return value;
      })
      .required(),
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
