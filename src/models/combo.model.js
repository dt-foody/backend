const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { Schema } = mongoose;

/**
 * MỚI: Enum định nghĩa 3 chế độ tính giá (cho Mongoose)
 */
const ComboPricingMode = {
  FIXED: 'FIXED',
  SLOT_PRICE: 'SLOT_PRICE',
  DISCOUNT: 'DISCOUNT',
};

/**
 * MỚI: Enum định nghĩa loại giảm giá
 */
const DiscountType = {
  PERCENT: 'PERCENT',
  AMOUNT: 'AMOUNT',
  NONE: 'NONE',
};

// --- 1. Sub-Schema cho các Sản phẩm trong Slot ---
const ComboSelectableProductSchema = new Schema({
  _id: false,
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  snapshotPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  additionalPrice: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  slotPrice: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
});

// --- 2. Sub-Schema cho Slot (Nhóm) ---
const ComboItemSchema = new Schema({
  _id: false,
  slotName: { type: String, required: true },
  selectableProducts: [ComboSelectableProductSchema],
  minSelection: { type: Number, required: true, min: 0, default: 1 },
  maxSelection: { type: Number, required: true, min: 0, default: 1 },
});

// --- 3. Combo Schema Chính (Đã cập nhật) ---
const ComboSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    items: [ComboItemSchema],
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // --- CÁC TRƯỜNG ĐÃ REFACTOR ---
    pricingMode: {
      type: String,
      enum: Object.values(ComboPricingMode),
      required: true,
      default: ComboPricingMode.FIXED,
    },
    comboPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    /** MỚI: Loại giảm giá */
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      default: DiscountType.NONE,
    },
    /** MỚI: Giá trị giảm giá */
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    /** BỎ: discountAmount */
    /** BỎ: discountPercent */
  },
  { timestamps: true }
);

// --- Index ---
ComboSchema.index({ isActive: 1, endDate: 1 });

// --- Plugins ---
ComboSchema.plugin(toJSON);
ComboSchema.plugin(paginate);

// --- CẬP NHẬT: Validator Logic nghiệp vụ ---
ComboSchema.pre('save', function (next) {
  // 1. Validate min/max selection
  for (const item of this.items) {
    if (item.maxSelection < item.minSelection) {
      return next(
        new Error(
          `Validation Error: Slot "${item.slotName}" maxSelection (${item.maxSelection}) must be >= minSelection (${item.minSelection}).`,
        ),
      );
    }
  }

  // 2. Validate và Reset logic dựa trên pricingMode
  if (this.pricingMode === ComboPricingMode.FIXED) {
    if (this.comboPrice <= 0) {
      return next(new Error('Validation Error: FIXED mode requires comboPrice > 0.'));
    }
    // Reset các trường không dùng
    this.discountType = DiscountType.NONE;
    this.discountValue = 0;
  }
  //
  else if (this.pricingMode === ComboPricingMode.SLOT_PRICE) {
    // Reset các trường không dùng
    this.comboPrice = 0;
    this.discountType = DiscountType.NONE;
    this.discountValue = 0;
  }
  //
  else if (this.pricingMode === ComboPricingMode.DISCOUNT) {
    if (this.discountType === DiscountType.NONE || !this.discountType) {
      return next(new Error('Validation Error: DISCOUNT mode requires a valid discountType (PERCENT or AMOUNT).'));
    }
    if (this.discountValue <= 0) {
      return next(new Error('Validation Error: DISCOUNT mode requires discountValue > 0.'));
    }
    // Reset trường không dùng
    this.comboPrice = 0;
  }
  //
  else {
    return next(new Error('Validation Error: Unknown pricingMode.'));
  }

  next(); // Tiếp tục lưu
});

const Combo = mongoose.model('Combo', ComboSchema);
module.exports = Combo;