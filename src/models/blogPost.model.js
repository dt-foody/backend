const mongoose = require('mongoose');
const slugify = require('slugify');
const { toJSON, paginate } = require('./plugins/index.js');

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
      unique: true,
      index: true,
    },
    summary: {
      type: String,
      trim: true,
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
      type: [
        { type: Schema.Types.ObjectId, ref: 'BlogCategory' },
      ],
      default: [],
    },
    tags: {
      type: [
        { type: Schema.Types.ObjectId, ref: 'BlogTag' },
      ],
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

// Tự động sinh slug nếu chưa có
BlogPostSchema.pre('validate', function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

// Ghi lại thời gian xuất bản
BlogPostSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

//
// --- 3. Indexes ---
//

// Lọc bài viết công khai mới nhất
BlogPostSchema.index({ status: 1, publishedAt: -1 });
// Lọc bài viết theo category
BlogPostSchema.index({ categories: 1, status: 1 });
// Lọc bài viết theo tags
BlogPostSchema.index({ tags: 1, status: 1 });
// Lọc featured / pinned
BlogPostSchema.index({ isFeatured: 1, isPinned: 1 });

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
