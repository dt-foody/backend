const Joi = require('joi');
const mongoose = require('mongoose');
const { objectId } = require('./custom.validation');

// Sub-schema cho discountSnapshot
const discountSnapshotSchema = Joi.object({
  type: Joi.string().valid('fixed_amount', 'percentage').required(),
  value: Joi.number().min(0).required(),
  maxDiscount: Joi.number().min(0).default(0),
  // Nếu bạn có lưu minOrderAmount trong snapshot thì thêm dòng dưới, nếu không thì bỏ qua
  // minOrderAmount: Joi.number().min(0).default(0),
}).required();

const create = {
  body: Joi.object().keys({
    // --- Thay đổi Customer thành Dynamic Profile ---
    // Cho phép null (trường hợp Guest hoặc Public Voucher chưa claim)
    profile: Joi.string().custom(objectId).allow(null),
    profileType: Joi.string().valid('Customer', 'Employee').allow(null),

    coupon: Joi.string().custom(objectId).required(),
    code: Joi.string().required(),

    issueMode: Joi.string().valid('CLAIM', 'ADMIN', 'AUTO', 'REFERRAL').default('ADMIN'),
    status: Joi.string().valid('UNUSED', 'USED', 'EXPIRED', 'REVOKED').default('UNUSED'),

    expiredAt: Joi.date().required(),
    usageLimit: Joi.number().min(1).default(1),

    discountSnapshot: discountSnapshotSchema,
  }),
};

const paginate = {
  query: Joi.object().keys({
    search: Joi.string().allow('', null),
    populate: Joi.string().allow('', null),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),

    // --- Filters updated ---
    profile: Joi.string().custom(objectId), // Tìm theo ID người dùng
    profileType: Joi.string().valid('Customer', 'Employee'), // Tìm theo loại user

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
      // --- Update Profile ---
      profile: Joi.string().custom(objectId).allow(null),
      profileType: Joi.string().valid('Customer', 'Employee').allow(null),

      coupon: Joi.string().custom(objectId),
      // order có thể là 1 ID hoặc mảng ID tuỳ logic, ở đây giữ nguyên custom(objectId) nếu update từng cái
      order: Joi.string().custom(objectId).allow(null),
      code: Joi.string(),

      status: Joi.string().valid('UNUSED', 'USED', 'EXPIRED', 'REVOKED'),
      expiredAt: Joi.date(),
      usageLimit: Joi.number().min(0),
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
