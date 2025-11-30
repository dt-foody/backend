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
      refPath: 'itemType', // Dynamic Reference: trỏ tới Product hoặc Combo tuỳ value của itemType
    },
    itemType: {
      type: String,
      required: true,
      enum: ['Product', 'Combo'],
    },
    name: {
      type: String,
      required: true,
    }, // Snapshot tên SP (phòng trường hợp sau này đổi tên món, lịch sử đơn vẫn đúng)

    // --- 2. SỐ LƯỢNG ---
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // --- 3. SNAPSHOT GIÁ (QUAN TRỌNG) ---
    /* Lý do cần 3 trường giá:
       1. originalBasePrice: Để so sánh hiệu quả giảm giá (Market Price).
       2. basePrice: Để tính doanh thu thuần từ sản phẩm (Selling Price).
       3. price: Để tính tổng bill khách phải trả (Final Price).
    */

    // A. Giá niêm yết trên Menu gốc tại thời điểm đặt
    // Ví dụ: Trà sữa (40k) -> Lưu 40000
    originalBasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // B. Giá gốc thực tế sau khi áp dụng Promotion (chưa cộng topping)
    // Ví dụ: Đang sale 20% (32k) -> Lưu 32000. Nếu không sale -> Lưu 40000
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // C. Đơn giá cuối cùng của 1 item (Đã bao gồm Base Price thực tế + Toppings)
    // Ví dụ: Base (32k) + Trân châu (5k) + Pudding (7k) -> Lưu 44000
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // --- 4. TÙY CHỌN KÈM THEO ---
    options: [OrderItemOptionSchema], // (Cần import schema option của bạn vào đây)
    comboSelections: [OrderItemComboSelectionSchema], // (Cần import schema combo selection vào đây)

    // --- 5. TRACKING KHUYẾN MÃI ---
    // Lưu ID chương trình KM đã áp dụng để truy vết, báo cáo doanh thu chiến dịch
    promotion: {
      type: Schema.Types.ObjectId,
      ref: 'PricePromotion',
      default: null,
    },

    // --- 6. GHI CHÚ KHÁCH HÀNG ---
    note: { type: String, default: '' },
  },
  { _id: false } // Tắt tự động tạo _id cho sub-doc để gọn data
);

/* ============================================================
 * 4. Main Order Schema
 * ============================================================ */
const OrderSchema = new Schema(
  {
    // Auto-increment readable ID
    orderId: { type: Number, unique: true, index: true },

    // Mã order PayOS sử dụng
    orderCode: { type: Number, index: true }, // 🔥 THÊM TRƯỜNG NÀY
    orderType: {
      type: String,
      enum: ['', 'TakeAway', 'DineIn', 'Delivery'],
      default: '',
    },

    profileType: {
      type: String,
      enum: ['Customer', 'Employee', null],
      default: null, // cho phép null
    },
    profile: {
      type: Schema.Types.ObjectId,
      refPath: 'profileType',
      default: null, // cho phép null
    },

    items: [OrderItemSchema],

    totalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

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
      qrCode: { type: String, default: '' }, // Optional cho đầy đủ
    },

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

    /* ============================================================
     * 🔥 Danh sách coupon đã áp dụng
     * ============================================================ */
    appliedCoupons: {
      type: [
        new Schema(
          {
            id: { type: Schema.Types.ObjectId, ref: 'Coupon' },
            code: { type: String },
            type: { type: String },
            value: { type: Number },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

/* ============================================================
 * Auto-Increment orderId
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

OrderSchema.plugin(toJSON);
OrderSchema.plugin(paginate);

module.exports = mongoose.model('Order', OrderSchema);
