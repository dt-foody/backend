/* eslint-disable no-await-in-loop */
const mongoose = require('mongoose');
const slugify = require('slugify');
const { toJSON, paginate } = require('./plugins/index');

const { Schema } = mongoose;

// --- 1. BlogPost Schema ---
const BlogPostSchema = new Schema(
  {
    // --- Thông tin chính ---
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      index: true,
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
      default: '',
    },
    content: {
      type: String, // HTML hoặc Markdown
      required: true,
    },
    coverImage: {
      type: String, // URL ảnh đại diện
      default: '',
    },
    coverImageAlt: {
      type: String,
      trim: true,
    },

    // --- Phân loại ---
    categories: {
      type: [{ type: Schema.Types.ObjectId, ref: 'BlogCategory' }],
      default: [],
    },
    tags: {
      type: [{ type: Schema.Types.ObjectId, ref: 'BlogTag' }],
      default: [],
    },

    // --- Trạng thái xuất bản ---
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },

    // --- SEO ---
    seoTitle: { type: String },
    seoDescription: { type: String },

    // --- Thống kê ---
    views: { type: Number, default: 0 },

    // --- Audit & Soft Delete ---
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

//
// --- 2. Hooks ---
//

/**
 * Hàm đệ quy tạo slug duy nhất
 * Ví dụ: "hello-world" -> "hello-world-1" -> "hello-world-2"
 */
async function generateUniqueSlug(title, model, _id = null) {
  const baseSlug = slugify(title, { lower: true, strict: true, locale: 'vi' });
  let uniqueSlug = baseSlug;
  let counter = 1;

  while (true) {
    // Tìm xem slug này đã tồn tại chưa (loại trừ chính document hiện tại nếu đang update)
    const existing = await model
      .findOne({
        slug: uniqueSlug,
        _id: { $ne: _id }, // Quan trọng: không check trùng với chính nó
      })
      .select('_id');

    if (!existing) {
      return uniqueSlug; // Chưa tồn tại -> Dùng được
    }

    // Đã tồn tại -> Thêm số vào đuôi và check lại
    uniqueSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

BlogPostSchema.pre('save', async function (next) {
  try {
    // 1. Xử lý Slug
    // Chỉ tạo slug nếu:
    // - Document mới tinh
    // - Hoặc Title thay đổi VÀ bài viết chưa Public (để tránh mất SEO)
    // - Hoặc user cố tình set slug rỗng để regenerate
    const isTitleChanged = this.isModified('title');
    const isPublished = this.status === 'published';

    if ((this.isNew && !this.slug) || (isTitleChanged && !isPublished)) {
      this.slug = await generateUniqueSlug(this.title, this.constructor, this._id);
    }

    // 2. Xử lý Published Date
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
      this.publishedAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

//
// --- 3. Indexes ---
//

// Lọc bài viết công khai mới nhất
BlogPostSchema.index({ status: 1, publishedAt: -1 });
// Lọc bài viết theo category
BlogPostSchema.index({ categories: 1, status: 1 });

//
// --- 4. Plugins ---
//
BlogPostSchema.plugin(toJSON);
BlogPostSchema.plugin(paginate);

//
// --- 5. Model ---
//
const BlogPost = mongoose.model('BlogPost', BlogPostSchema);
module.exports = BlogPost;
