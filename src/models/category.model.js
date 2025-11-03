const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { Schema } = mongoose;

const CategorySchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    ancestors: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// ======================================================
// ==================  PLUGINS  ==========================
// ======================================================
CategorySchema.index({ name: 1, parent: 1 }, { unique: true });
CategorySchema.plugin(toJSON);
CategorySchema.plugin(paginate);

// ======================================================
// ==================  PRE SAVE  =========================
// ======================================================
CategorySchema.pre('save', async function (next) {
  if (!this.parent) {
    this.ancestors = [];
    return next();
  }

  const parentCategory = await this.constructor.findById(this.parent).select('ancestors');
  if (!parentCategory) return next(new Error('Parent category not found'));

  this.ancestors = [...parentCategory.ancestors, parentCategory._id];
  next();
});

async function updateChildrenAncestors(model, parentId, parentAncestors) {
  const children = await model.find({ parent: parentId, isDeleted: false });
  // eslint-disable-next-line no-restricted-syntax
  for (const child of children) {
    const newAncestors = [...parentAncestors, parentId];
    // eslint-disable-next-line no-await-in-loop
    await model.updateOne({ _id: child._id, ancestors: { $ne: newAncestors } }, { $set: { ancestors: newAncestors } });
    // eslint-disable-next-line no-await-in-loop
    await updateChildrenAncestors(model, child._id, newAncestors);
  }
}

CategorySchema.pre(['updateOne', 'findOneAndUpdate'], { document: false, query: true }, async function (next) {
  const query = this.getQuery();
  const update = this.getUpdate() || {};
  const { model } = this;

  const category = await model.findOne(query).lean();
  if (!category) return next();

  this._categoryBefore = category;
  this._updateData = update;

  // Nếu đổi parent thì cập nhật lại ancestors
  if (update && update.parent && update.parent.toString() !== (category.parent || '').toString()) {
    const newParent = await model.findById(update.parent).select('ancestors');
    if (!newParent) return next(new Error('Parent not found'));
    const newAncestors = [...newParent.ancestors, newParent._id];
    this.setUpdate({ ...update, ancestors: newAncestors });
  }

  next();
});

CategorySchema.post(['updateOne', 'findOneAndUpdate'], { document: false, query: true }, async function (res) {
  const { model } = this;
  const before = this._categoryBefore;
  const update = this._updateData;

  // Lấy lại document mới nhất
  const doc = await model.findOne(this.getQuery()).lean();
  if (!doc) return;

  // Case 1: đổi parent
  if (update && update.parent && update.parent.toString() !== (before.parent || '').toString()) {
    await updateChildrenAncestors(model, doc._id, doc.ancestors);
  }

  // Case 2: Soft delete
  if (update && update.isDeleted === true && !before.isDeleted) {
    const children = await model.find({ parent: doc._id });

    // eslint-disable-next-line no-restricted-syntax
    for (const child of children) {
      const newParent = doc.parent || null;
      const newAncestors = newParent ? [...doc.ancestors] : [];

      // eslint-disable-next-line no-await-in-loop
      await model.updateOne({ _id: child._id }, { parent: newParent, ancestors: newAncestors });

      // eslint-disable-next-line no-await-in-loop
      await updateChildrenAncestors(model, child._id, newAncestors);
    }
  }
});

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;
