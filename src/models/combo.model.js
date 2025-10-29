const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins/index.js'); // Giả định các plugin này tồn tại

const { Schema } = mongoose;

// --- 1. Sub-Schema cho các Sản phẩm trong Combo (Combo Item Schema) ---
// Định nghĩa các thành phần/vị trí trong Combo (VD: 1 đồ uống, 1 món ăn vặt)
const ComboItemSchema = new Schema(
  {
    // Tên vị trí/Thành phần trong combo (VD: Đồ uống chính, Món ăn kèm)
    slotName: { type: String, required: true }, 

    // Mảng các Product/Variants có thể chọn cho vị trí này
    selectableProducts: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        // Mặc dù Product có basePrice, ta nhúng lại giá để đảm bảo giá Combo cố định
        fixedPrice: { 
          type: Number,
          required: true, 
          min: 0 
        },
        // Có thể thêm giới hạn về số lượng (VD: chỉ được chọn 1)
        maxQuantity: { type: Number, default: 1 }
      },
    ],
    // Ràng buộc chọn: Bắt buộc chọn ít nhất 1 sản phẩm cho vị trí này không?
    isRequired: { type: Boolean, default: true }, 
  },
  { _id: false }
);

// --- 2. Combo Schema Chính ---
const ComboSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    
    // Giá BÁN CỦA CẢ COMBO (thường là giá cố định đã giảm)
    comboPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Ảnh đại diện Combo
    thumbnailUrl: { type: String, default: '' },
    
    // Ngày bắt đầu và kết thúc áp dụng Combo
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Các thành phần của Combo
    items: [ComboItemSchema], 
    
    // Thuộc tính quản lý và Audit (Tương tự Product & Category)
    isActive: { type: Boolean, default: true }, 
    priority: { type: Number, default: 0 }, 
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- Index ---
ComboSchema.index({ isActive: 1, endDate: 1 }); // Tối ưu tìm kiếm combo đang hoạt động

// --- Plugins ---
ComboSchema.plugin(toJSON);
ComboSchema.plugin(paginate);

const Combo = mongoose.model('Combo', ComboSchema);
module.exports = Combo;