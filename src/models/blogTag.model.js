const mongoose = require('mongoose');
const slugify = require('slugify');
const { toJSON, paginate } = require('./plugins/index.js');
const { Schema } = mongoose;

const BlogTagSchema = new Schema(
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
    description: {
      type: String,
      default: '',
      trim: true,
    },
    postCount: {
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
BlogTagSchema.plugin(toJSON);
BlogTagSchema.plugin(paginate);

// --- Hooks ---
BlogTagSchema.pre('validate', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

const BlogTag = mongoose.model('BlogTag', BlogTagSchema);
module.exports = BlogTag;