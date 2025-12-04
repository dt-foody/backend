const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins'); // Giả định các plugin này tồn tại

const { Schema } = mongoose;

// --- 1. Sub-Schema cho các Tùy Chọn (Product Option Schema) ---
// Dùng để nhúng vào mảng 'options' bên trong 'optionGroups'
const ProductOptionSchema = new Schema(
  {
    name: { type: String, required: true },
    priceModifier: {
      type: Number, // Sử dụng Number cho tiền tệ chính xác
      required: true,
      default: 0,
    },
    type: {
      type: String,
      enum: ['fixed_amount', 'percentage'], // Loại thay đổi giá
      default: 'fixed_amount',
    },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 }, // Thứ tự hiển thị option trong nhóm
  },
  { _id: false } // Không cần _id riêng cho mỗi option, dùng index mảng
);

// --- 2. Sub-Schema cho Nhóm Tùy Chọn (Product Option Group Schema) ---
// Dùng để nhúng vào mảng 'optionGroups'
const ProductOptionGroupSchema = new Schema(
  {
    name: { type: String, required: true },
    // Ràng buộc số lượng chọn
    minOptions: { type: Number, default: 0 }, // Số lượng tối thiểu phải chọn
    maxOptions: { type: Number, default: 1 }, // Số lượng tối đa được chọn (vd: 1 cho size, 3 cho topping)
    priority: { type: Number, default: 0 }, // Thứ tự hiển thị nhóm tùy chọn

    // Mảng nhúng các tùy chọn cụ thể
    options: [ProductOptionSchema],
  },
  { _id: false } // Không cần _id riêng cho mỗi nhóm, dùng index mảng
);

// --- 3. Product Schema Chính ---
const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    basePrice: {
      type: Number,
      default: 0,
    },

    // Liên kết với Category (FK)
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },

    image: { type: String, default: '' },

    // Thuộc tính quản lý
    isActive: { type: Boolean, default: true }, // Trạng thái bán
    priority: { type: Number, default: 0 }, // Thứ tự hiển thị sản phẩm trong Category

    // Mảng nhúng các nhóm tùy chọn (Size, Topping, etc.)
    optionGroups: [ProductOptionGroupSchema],

    // --- Audit & Soft Delete Fields (Tương tự CategorySchema) ---
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- Index ---
// Index để tối ưu tìm kiếm theo Category và đảm bảo tính duy nhất của tên trong Category
ProductSchema.index({ category: 1, name: 1 });
// Index cho tìm kiếm nhanh theo trạng thái và ưu tiên (dùng khi hiển thị menu)
ProductSchema.index({ isActive: 1, priority: 1 });

// --- Plugins ---
ProductSchema.plugin(toJSON);
ProductSchema.plugin(paginate);

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;
