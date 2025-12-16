const mongoose = require('mongoose');
const slugify = require('slugify');
const { toJSON, paginate } = require('./plugins/index');

const { Schema } = mongoose;

const BlogCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    description: {
      // Mô tả ngắn, tốt cho SEO trang danh mục
      type: String,
      default: '',
      trim: true,
    },
    backgroundColor: {
      type: String,
      default: '#E0E0E0', // Màu xám nhạt mặc định
      trim: true,
    },
    textColor: {
      type: String,
      default: '#212121', // Màu đen/xám rất đậm mặc định
      trim: true,
    },
    coverImage: {
      // Ảnh đại diện cho danh mục
      type: String,
      default: '',
    },
    postCount: {
      // Denormalization để tăng tốc query
      type: Number,
      default: 0,
    },
    priority: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // --- Audit & Soft Delete ---
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- Plugins ---
BlogCategorySchema.plugin(toJSON);
BlogCategorySchema.plugin(paginate);

// --- Hooks ---
// Tự động sinh slug
BlogCategorySchema.pre('validate', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

const BlogCategory = mongoose.model('BlogCategory', BlogCategorySchema);
module.exports = BlogCategory;
