const mongoose = require('mongoose');

const { Schema } = mongoose;
const Counter = require('./counter.model');
const { toJSON, paginate } = require('./plugins');

/* ============================================================
 * 1. OrderItemOptionSchema
 * ============================================================ */
const OrderItemOptionSchema = new Schema(
  {
    groupName: { type: String, required: true },
    optionName: { type: String, required: true },
    priceModifier: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/* ============================================================
 * 2. ComboSelection Schema
 * ============================================================ */
const OrderItemComboSelectionSchema = new Schema(
  {
    slotName: { type: String, required: true },

    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    basePrice: { type: Number, default: 0 },
    additionalPrice: { type: Number, default: 0 },

    options: [OrderItemOptionSchema],
  },
  { _id: false }
);

/* ============================================================
 * 3. OrderItem Schema
 * ============================================================ */
const OrderItemSchema = new Schema(
  {
    // --- 1. ĐỊNH DANH SẢN PHẨM ---
    item: {
      type: Schema.Types.ObjectId,
      required: true,
      ref(doc) {
        if (doc && doc.itemType) {
          return doc.itemType;
        }
        return 'Product';
      },
    },
    itemType: {
      type: String,
      required: true,
      enum: ['Product', 'Combo'],
    },
    name: { type: String, required: true },

    // --- 2. SỐ LƯỢNG ---
    quantity: { type: Number, required: true, min: 1 },

    // --- 3. SNAPSHOT GIÁ ---
    originalBasePrice: { type: Number, required: true, min: 0 }, // Giá thị trường
    basePrice: { type: Number, required: true, min: 0 }, // Giá bán (sau promo product/combo)
    price: { type: Number, required: true, min: 0 }, // Giá final (đã + topping)

    // --- 4. TÙY CHỌN KÈM THEO ---
    options: [OrderItemOptionSchema],
    comboSelections: [OrderItemComboSelectionSchema],

    // --- 5. TRACKING KHUYẾN MÃI SẢN PHẨM ---
    promotion: {
      type: Schema.Types.ObjectId,
      ref: 'PricePromotion',
      default: null,
    },

    note: { type: String, default: '' },
  },
  { _id: false }
);

/* ============================================================
 * 4. Applied Coupon Schema (THIẾT KẾ ĐA HÌNH - POLYMORPHIC)
 * ============================================================ */
const AppliedCouponSchema = new Schema(
  {
    code: { type: String, required: true }, // VD: "SALE50"
    name: { type: String, default: '' }, // VD: "Giảm 50% Tết"

    // Dynamic Reference: Trỏ tới bảng Coupon hoặc Voucher
    ref: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'appliedCoupons.refModel', // Cú pháp trỏ tới field refModel bên dưới
    },
    refModel: {
      type: String,
      required: true,
      enum: ['Coupon', 'Voucher'], // Chỉ chấp nhận 2 model này
    },

    discountType: { type: String, enum: ['fixed_amount', 'percentage', 'freeship'], required: true },
    discountValue: { type: Number, default: 0 }, // Giá trị gốc (VD: 10%)
    amount: { type: Number, required: true, min: 0 }, // Số tiền thực tế giảm (VD: 15.000)
  },
  { _id: false }
);

/* ============================================================
 * 5. Main Order Schema
 * ============================================================ */
const OrderSchema = new Schema(
  {
    orderId: { type: Number, unique: true, index: true }, // Auto-increment ID
    orderCode: { type: Number, index: true }, // PayOS Order Code

    orderType: {
      type: String,
      enum: ['', 'TakeAway', 'DineIn', 'Delivery'],
      default: '',
    },

    // Người đặt hàng (Profile)
    profileType: {
      type: String,
      enum: ['Customer', 'Employee', null],
      default: null,
    },
    profile: {
      type: Schema.Types.ObjectId,
      refPath: 'profileType',
      default: null,
    },

    items: [OrderItemSchema],

    // Tài chính
    totalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    // Thanh toán
    payment: {
      method: {
        type: String,
        enum: ['cash', 'payos', 'momo', 'vnpay', 'bank_transfer'],
        default: 'cash',
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: { type: String, default: '' },
      checkoutUrl: { type: String, default: '' },
      qrCode: { type: String, default: '' },
      message: { type: String, default: '' },
    },

    // Giao hàng (Địa chỉ)
    shipping: {
      type: new Schema(
        {
          address: {
            label: String,
            recipientName: String,
            recipientPhone: String,
            street: String,
            ward: String,
            district: String,
            city: String,
            location: {
              type: { type: String, enum: ['Point'], default: 'Point' },
              coordinates: { type: [Number] },
            },
          },
          status: {
            type: String,
            enum: ['pending', 'preparing', 'delivering', 'delivered', 'failed', 'canceled'],
            default: 'pending',
          },
        },
        { _id: false }
      ),
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'completed', 'canceled', 'refunded'],
      default: 'pending',
      index: true,
    },

    note: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // 🔥 DANH SÁCH MÃ GIẢM GIÁ (Đã cập nhật Schema mới)
    appliedCoupons: {
      type: [AppliedCouponSchema],
      default: [],
    },

    // 🔥 DELIVERY TIME (Thông tin hiển thị)
    deliveryTime: {
      type: new Schema(
        {
          option: {
            type: String,
            enum: ['immediate', 'scheduled'],
            default: 'immediate',
            required: true,
          },
          scheduledAt: { type: Date, default: null },
          timeSlot: { 
            type: String, 
            default: null,
          },
        },
        { _id: false }
      ),
      default: { option: 'immediate', scheduledAt: null },
    },

    // 🔥 PRIORITY TIME (Dùng để sort đơn hàng)
    priorityTime: {
      type: Date,
      index: true,
      required: true, // Giữ required: true vì hook pre-validate sẽ điền
    },
  },
  { timestamps: true }
);

/* ============================================================
 * 1️⃣ Hook PRE-VALIDATE: Tính toán dữ liệu (PriorityTime)
 * Chạy TRƯỚC khi validate, đảm bảo priorityTime luôn có giá trị
 * ============================================================ */
OrderSchema.pre('validate', function (next) {
  // Chỉ tính toán khi tạo mới hoặc khi field deliveryTime thay đổi
  if (this.isNew || this.isModified('deliveryTime')) {
    const deliveryOption = this.deliveryTime?.option;
    const scheduledAt = this.deliveryTime?.scheduledAt;

    if (deliveryOption === 'scheduled' && scheduledAt) {
      // Nếu là đơn đặt lịch -> Lấy giờ hẹn
      this.priorityTime = scheduledAt;
    } else {
      // Nếu là giao ngay -> Lấy giờ hiện tại
      // Lưu ý: Dùng new Date() thay vì this.createdAt vì lúc validate createdAt có thể chưa sinh
      this.priorityTime = this.createdAt || new Date();
    }
  }
  next();
});

/* ============================================================
 * 2️⃣ Hook PRE-SAVE: Auto-Increment OrderId
 * Chỉ chạy khi validate đã OK
 * ============================================================ */
OrderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { sequenceName: 'orderId' },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );

    this.orderId = counter.sequenceValue;
    next();
  } catch (err) {
    next(err);
  }
});

/* ============================================================
 * 3️⃣ Hook PRE-UPDATE: Xử lý khi Admin sửa đơn
 * ============================================================ */
OrderSchema.pre(['updateOne', 'findOneAndUpdate'], async function (next) {
  try {
    const update = this.getUpdate();
    const deliveryTimeUpdate = update.deliveryTime || (update.$set && update.$set.deliveryTime);

    if (deliveryTimeUpdate) {
      let newPriorityTime;

      // Nếu đổi sang đặt lịch
      if (deliveryTimeUpdate.option === 'scheduled' && deliveryTimeUpdate.scheduledAt) {
        newPriorityTime = deliveryTimeUpdate.scheduledAt;
      } else {
        // Nếu đổi sang giao ngay -> Tìm document cũ để lấy createdAt gốc
        const docToUpdate = await this.model.findOne(this.getQuery());
        newPriorityTime = docToUpdate ? docToUpdate.createdAt : new Date();
      }

      this.set({ priorityTime: newPriorityTime });
    }
    next();
  } catch (err) {
    next(err);
  }
});

OrderSchema.plugin(toJSON);
OrderSchema.plugin(paginate);

module.exports = mongoose.model('Order', OrderSchema);
