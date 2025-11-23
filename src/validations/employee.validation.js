const Joi = require('joi');
const { objectId } = require('./custom.validation');

// --- Schema con (Giữ nguyên) ---
const addressSchema = Joi.object().keys({
  _id: Joi.string().allow('', null),
  label: Joi.string().allow('', null),
  recipientName: Joi.string().required().trim(),
  recipientPhone: Joi.string().required().trim(),
  street: Joi.string().required().trim(),
  ward: Joi.string().required().trim(),
  district: Joi.string().required().trim(),
  city: Joi.string().required().trim(),
  fullAddress: Joi.string().allow('', null),
  location: Joi.object()
    .keys({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array(), // .length(2).items(Joi.number()).required(), // [lng, lat]
    })
    .optional(),
  isDefault: Joi.boolean().default(false),
});

const emailSchema = Joi.object({
  type: Joi.string().valid('Home', 'Company', 'Other').default('Other'),
  value: Joi.string().email().required().trim().lowercase(),
  isPrimary: Joi.boolean().default(false),
});

const phoneSchema = Joi.object({
  type: Joi.string()
    .valid('Mobile', 'Work', 'Home', 'Fax', 'Other') // Cập nhật danh sách này
    .default('Mobile'), // Nên để mặc định là Mobile

  value: Joi.string()
    // Bonus: Thêm regex để chỉ cho phép số và dấu + (độ dài 10-15 ký tự)
    // Nếu muốn chặt chẽ cho VN thì dùng regex: /^(0|84)(3|5|7|8|9)([0-9]{8})$/
    .pattern(/^[0-9+]{9,15}$/)
    .message('Số điện thoại không hợp lệ')
    .required()
    .trim(),

  isPrimary: Joi.boolean().default(false),
});

// --- [MỚI] Schema cho User (Tài khoản) ---
const createUserSchema = Joi.object().keys({
  email: Joi.string().required().email().trim().lowercase(),
  password: Joi.string().required().min(6).trim(), // Bắt buộc khi tạo mới
  role: Joi.string().default('staff'),
  roles: Joi.array().items(Joi.string().custom(objectId)),
  isActive: Joi.boolean().default(true),
  isEmailVerified: Joi.boolean().default(false),
  extraPermissions: Joi.array().items(Joi.string().custom(objectId)),
  excludePermissions: Joi.array().items(Joi.string().custom(objectId)),
});

const updateUserSchema = Joi.object().keys({
  email: Joi.string().email().trim().lowercase(),
  password: Joi.string().min(6).trim(), // Optional khi update (nếu không đổi pass)
  role: Joi.string(),
  roles: Joi.array().items(Joi.string().custom(objectId)),
  isActive: Joi.boolean(),
  isEmailVerified: Joi.boolean(),
  extraPermissions: Joi.array().items(Joi.string().custom(objectId)),
  excludePermissions: Joi.array().items(Joi.string().custom(objectId)),
});

// --- CREATE ---
const create = {
  body: Joi.object().keys({
    // 1. Thông tin Employee (Bên ngoài)
    name: Joi.string().required().trim(),
    gender: Joi.string().valid('male', 'female', 'other').default('male'),
    birthDate: Joi.date().allow(null, ''), // Cho phép null hoặc rỗng

    emails: Joi.array().items(emailSchema),
    phones: Joi.array().items(phoneSchema),
    addresses: Joi.array().items(addressSchema),

    // 2. Thông tin User (Nested Object & Optional)
    // Cho phép null nếu không muốn tạo tài khoản
    user: createUserSchema.optional().allow(null),
  }),
};

// --- PAGINATE ---
const paginate = {
  query: Joi.object().keys({
    search: Joi.string(),
    name: Joi.string().trim(),
    email: Joi.string().email().trim(), // Search login email
    phone: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    sortBy: Joi.string().allow('', null),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string().allow('', null),
  }),
};

// --- FIND BY ID ---
const findById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

// --- UPDATE BY ID ---
const updateById = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      // 1. Update Employee Info
      name: Joi.string().trim(),
      gender: Joi.string().valid('male', 'female', 'other'),
      birthDate: Joi.date().allow(null, ''),

      emails: Joi.array().items(emailSchema),
      phones: Joi.array().items(phoneSchema),
      addresses: Joi.array().items(addressSchema),

      // 2. Update User Info (Nested)
      user: updateUserSchema.optional().allow(null),
    })
    .min(1), // Ít nhất 1 trường được gửi lên
};

// --- DELETE ---
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
