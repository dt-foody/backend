/* eslint-disable no-await-in-loop */
const mongoose = require('mongoose');

const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Ho_Chi_Minh');

const BaseService = require('../utils/_base.service');
const {
  Order,
  Product,
  Combo,
  Coupon,
  PricePromotion,
  Voucher,
  Customer,
  Employee,
  Surcharge,
  Notification,
} = require('../models');
const { getPayOS } = require('../config/payos');
const config = require('../config/config');
const logger = require('../config/logger');

const { getDistanceInKm } = require('../utils/map.util');
const { emitOrderUpdate } = require('../utils/socket.util');
const { calculateShippingFeeByFormula } = require('../utils/shipping.util');

const auditLogService = require('./auditLog.service');
const notificationService = require('./notification.service');

class OrderService extends BaseService {
  constructor() {
    super(Order);
    this.payos = getPayOS();
    this.customerOrder = this.customerOrder.bind(this);
    this.adminPanelCreateOrder = this.adminPanelCreateOrder.bind(this);
    this.adminPanelUpdateOrder = this.adminPanelUpdateOrder.bind(this);
    this.calculateShippingFee = this.calculateShippingFee.bind(this);
    this.getUserPromotionUsageMap = this.getUserPromotionUsageMap.bind(this);
    this.scanAndHandlePendingOrders = this.scanAndHandlePendingOrders.bind(this);
    this.scanAndNotifyUpcomingOrders = this.scanAndNotifyUpcomingOrders.bind(this);
  }

  /**
   * Lấy bản đồ số lượng sử dụng Promotion của User
   * @param {string} userId
   * @param {string[]} relevantPromoIds - Chỉ các ID có maxQuantityPerCustomer > 0
   * @returns {Promise<Map<string, number>>}
   */
  async getUserPromotionUsageMap(user, profile, relevantPromoIds) {
    const usageMap = new Map();

    if (!user || !profile || !relevantPromoIds || relevantPromoIds.length === 0) {
      return usageMap;
    }

    const promoObjectIds = relevantPromoIds.map((id) => new mongoose.Types.ObjectId(id));

    // Thống kê bằng Aggregation trên this.model
    const stats = await this.model.aggregate([
      {
        $match: {
          profile: new mongoose.Types.ObjectId(profile._id || profile.id),
          status: {
            $nin: ['canceled', 'refunded'],
          },
        },
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.promotion': { $in: promoObjectIds },
        },
      },
      {
        $group: {
          _id: '$items.promotion',
          totalUsed: { $sum: '$items.quantity' },
        },
      },
    ]);

    stats.forEach((stat) => {
      usageMap.set(stat._id.toString(), stat.totalUsed);
    });

    return usageMap;
  }

  /* ============================================================
   * HELPER METHODS
   * ============================================================ */
  async calculateShippingFee(customerLocation, orderTime) {
    const storeLoc = config.hereMap.storeLocation;
    const distance = await getDistanceInKm(storeLoc, customerLocation);
    const shippingFee = calculateShippingFeeByFormula(distance, orderTime);

    logger.info(`[DEBUG] Shipping Calc: Distance=${distance.toFixed(2)}km, Fee=${shippingFee}`);

    return { distance: parseFloat(distance.toFixed(2)), shippingFee };
  }

  static normalizeOptions(optionsObj) {
    if (!optionsObj || typeof optionsObj !== 'object') return [];
    return Object.entries(optionsObj).flatMap(([groupName, options]) => {
      return (options || []).map((opt) => ({
        groupName,
        optionName: opt.name,
        priceModifier: opt.priceModifier || 0,
      }));
    });
  }

  static calculatePromotionDiscount(originalPrice, promotion) {
    if (!promotion) return 0;
    let discountAmount = 0;
    const type = (promotion.discountType || '').toLowerCase();

    if (type === 'percentage' || type === 'percent') {
      discountAmount = originalPrice * (promotion.discountValue / 100);
      if (promotion.maxDiscountAmount && promotion.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
      }
    } else if (type === 'fixed_amount' || type === 'amount') {
      discountAmount = promotion.discountValue;
    }
    return Math.round(discountAmount);
  }

  /* ============================================================
   * 1. BUILD ITEMS
   * ============================================================ */
  static async buildOrderItemsFromMenu(profile, items) {
    const now = new Date();

    // Chỉ tìm promotion khi client truyền id
    const findActivePromotion = async (promotionId) => {
      if (!promotionId) return null;
      const promotion = await PricePromotion.findOne({
        _id: promotionId,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        isDeleted: false,
      });
      if (!promotion) return null;

      // 1. Check giới hạn Global (Tổng hệ thống)
      if (promotion.maxQuantity > 0 && promotion.usedQuantity >= promotion.maxQuantity) return null;

      // 2. Check giới hạn theo Ngày
      if (promotion.dailyMaxUses > 0) {
        const isSameDay = promotion.lastUsedDate && new Date(promotion.lastUsedDate).toDateString() === now.toDateString();
        if (isSameDay && promotion.dailyUsedCount >= promotion.dailyMaxUses) return null;
      }

      // 3. Check giới hạn theo User (Chỉ check khi có config và có user)
      if (promotion.maxQuantityPerCustomer > 0 && profile) {
        const usageStats = await Order.aggregate([
          {
            $match: {
              profile: new mongoose.Types.ObjectId(profile),
              status: { $nin: ['canceled', 'refunded'] },
              'items.promotion': promotion._id,
            },
          },
          { $unwind: '$items' },
          { $match: { 'items.promotion': promotion._id } },
          { $group: { _id: null, total: { $sum: '$items.quantity' } } },
        ]);
        const usedCount = usageStats.length > 0 ? usageStats[0].total : 0;
        if (usedCount >= promotion.maxQuantityPerCustomer) {
          return null;
        }
      }
      return promotion;
    };

    return Promise.all(
      items.map(async (cartItem) => {
        if (cartItem.itemType === 'Product') {
          const product = await Product.findById(cartItem.item.id);
          if (!product) throw new Error(`Sản phẩm không tồn tại: ${cartItem.item.name}`);

          const originalBasePrice = product.basePrice;
          const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
          const priceBeforePromo = product.basePrice + optionsPrice;

          // Chỉ tìm promotion nếu client truyền id
          let activePromo = null;
          if (cartItem.item.promotion) {
            activePromo = await findActivePromotion(cartItem.item.promotion);
          }

          // Tính discount cho số lượng được phép
          const discountAmount = OrderService.calculatePromotionDiscount(priceBeforePromo, activePromo);
          const finalPrice = Math.max(0, priceBeforePromo - discountAmount);

          logger.info(
            `[DEBUG] Product Item: ${product.name} | Base=${originalBasePrice} | Opts=${optionsPrice} | PromoDiscount=${discountAmount} | Final=${finalPrice}`
          );

          return {
            item: product._id,
            itemType: 'Product',
            name: product.name,
            quantity: cartItem.quantity,
            originalBasePrice,
            basePrice: product.basePrice,
            price: finalPrice,
            options: normalizedOptions,
            comboSelections: [],
            note: cartItem.note || '',
            promotion: activePromo ? activePromo._id : null,
          };
        }

        if (cartItem.itemType === 'Combo') {
          const combo = await Combo.findById(cartItem.item.id);
          if (!combo) throw new Error(`Combo không tồn tại: ${cartItem.item.name}`);

          let totalSurcharges = 0;
          let totalOptions = 0;
          let totalComponentBase = 0;
          let totalMarketPrice = 0;

          const selectionPromises = (cartItem.comboSelections || []).map(async (selection) => {
            const product = await Product.findById(selection.product.id);
            if (!product) throw new Error(`Món "${selection.productName}" không tồn tại`);

            let additionalPrice = 0;
            let slotPrice = 0;
            const comboSlotConfig = (combo.items || []).find((slot) => slot.slotName === selection.slotName);
            if (comboSlotConfig) {
              const productConfig = (comboSlotConfig.selectableProducts || []).find(
                (p) => p.product.toString() === product._id.toString()
              );
              if (productConfig) {
                additionalPrice = productConfig.additionalPrice || 0;
                slotPrice = productConfig.slotPrice || 0;
              }
            }

            const normalizedOptions = OrderService.normalizeOptions(selection.options);
            const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);

            totalSurcharges += additionalPrice;
            totalOptions += optionsPrice;
            totalMarketPrice += product.basePrice + optionsPrice + additionalPrice;

            if (combo.pricingMode === 'SLOT_PRICE') {
              totalComponentBase += slotPrice;
            } else if (combo.pricingMode === 'DISCOUNT') {
              totalComponentBase += product.basePrice;
            }

            return {
              doc: {
                product: product._id,
                productName: product.name,
                basePrice: product.basePrice,
                additionalPrice,
                options: normalizedOptions,
                slotName: selection.slotName,
              },
            };
          });

          const resolvedSelections = await Promise.all(selectionPromises);

          let priceBaseCombo = 0;
          if (combo.pricingMode === 'FIXED') {
            priceBaseCombo = combo.comboPrice;
          } else if (combo.pricingMode === 'SLOT_PRICE') {
            priceBaseCombo = totalComponentBase;
          } else if (combo.pricingMode === 'DISCOUNT') {
            const discType = (combo.discountType || '').toLowerCase();
            if (discType === 'percentage' || discType === 'percent') {
              priceBaseCombo = Math.round(totalComponentBase * (1 - combo.discountValue / 100));
            } else if (discType === 'fixed_amount' || discType === 'amount') {
              priceBaseCombo = Math.max(0, totalComponentBase - combo.discountValue);
            } else {
              priceBaseCombo = totalComponentBase;
            }
          } else {
            priceBaseCombo = combo.comboPrice || 0;
          }

          const priceBeforePromo = priceBaseCombo + totalSurcharges + totalOptions;

          // Chỉ tìm promotion nếu client truyền id
          let activePromo = null;
          if (cartItem.item.promotion) {
            activePromo = await findActivePromotion(cartItem.item.promotion);
          }

          const promoDiscountAmount = OrderService.calculatePromotionDiscount(priceBeforePromo, activePromo);
          const finalPrice = Math.max(0, priceBeforePromo - promoDiscountAmount);

          logger.info(
            `[DEBUG] Combo Item: ${combo.name} | Base=${priceBaseCombo} | Surcharge=${totalSurcharges} | Opts=${totalOptions} | Final=${finalPrice}`
          );

          return {
            item: combo._id,
            itemType: 'Combo',
            name: combo.name,
            quantity: cartItem.quantity,
            originalBasePrice: totalMarketPrice,
            basePrice: priceBaseCombo,
            price: finalPrice,
            options: [],
            comboSelections: resolvedSelections.map((r) => r.doc),
            note: cartItem.note || '',
            promotion: activePromo ? activePromo._id : null,
          };
        }
        throw new Error('Loại item không xác định.');
      })
    );
  }

  // [NEW] Helper: Xây dựng Order Item từ cấu hình quà tặng (Gift Items)
  static async buildGiftItems(giftRequests) {
    if (!giftRequests || giftRequests.length === 0) return [];

    const builtGifts = await Promise.all(
      giftRequests.map(async (gift) => {
        // gift: { item: id, itemType: 'Product'|'Combo', quantity: 1, price: 0, sourceCouponCode: '...' }
        const quantity = gift.quantity || 1;
        const price = gift.price || 0; // Giá được cấu hình từ coupon (0 hoặc giá ưu đãi)

        if (gift.itemType === 'Product') {
          const product = await Product.findById(gift.item);
          if (!product) {
            logger.warn(`Gift Product not found: ${gift.item}`);
            return null;
          }
          return {
            item: product._id,
            itemType: 'Product',
            name: product.name,
            quantity,
            originalBasePrice: product.basePrice,
            basePrice: price, // Với quà tặng, basePrice coi như bằng giá bán ưu đãi
            price, // Giá cuối cùng
            options: [],
            comboSelections: [],
            note: `Quà tặng từ mã: ${gift.sourceCouponCode || ''}`,
            promotion: null,
            isGift: true, // Marker để phân biệt
          };
        }

        if (gift.itemType === 'Combo') {
          const combo = await Combo.findById(gift.item);
          if (!combo) {
            logger.warn(`Gift Combo not found: ${gift.item}`);
            return null;
          }
          // Với Combo quà tặng, hiện tại chưa hỗ trợ options phức tạp, lấy mặc định
          return {
            item: combo._id,
            itemType: 'Combo',
            name: combo.name,
            quantity,
            originalBasePrice: combo.comboPrice || 0,
            basePrice: price,
            price,
            options: [],
            comboSelections: [], // Giả sử quà tặng combo không cần chọn món
            note: `Quà tặng từ mã: ${gift.sourceCouponCode || ''}`,
            promotion: null,
            isGift: true,
          };
        }
        return null;
      })
    );

    return builtGifts.filter((g) => g !== null);
  }

  static buildOrderItemsFromSnapshot(items) {
    if (!Array.isArray(items)) return [];
    return items.map((cartItem) => {
      const quantity = cartItem.quantity || 1;
      if (cartItem.itemType === 'Product') {
        const basePrice = cartItem.basePrice || 0;
        const normalizedOptions = OrderService.normalizeOptions(cartItem.options);
        const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
        return {
          ...cartItem,
          item: cartItem.item.id || cartItem.item,
          quantity,
          basePrice,
          price: basePrice + optionsPrice,
          options: normalizedOptions,
        };
      }
      if (cartItem.itemType === 'Combo') {
        const comboBasePrice = cartItem.basePrice || 0;
        let totalExtras = 0;
        const selectionDocs = (cartItem.comboSelections || []).map((selection) => {
          const normalizedOptions = OrderService.normalizeOptions(selection.options);
          const optionsPrice = normalizedOptions.reduce((s, o) => s + o.priceModifier, 0);
          const additionalPrice = selection.additionalPrice || 0;
          totalExtras += optionsPrice + additionalPrice;
          return { doc: { ...selection, options: normalizedOptions } };
        });
        return {
          ...cartItem,
          item: cartItem.item.id || cartItem.item,
          quantity,
          basePrice: comboBasePrice,
          price: comboBasePrice + totalExtras,
          comboSelections: selectionDocs.map((r) => r.doc),
        };
      }
      return cartItem;
    });
  }

  /* ============================================================
   * 2. LOGIC TÍNH DISCOUNT & COLLECT GIFTS
   * ============================================================ */
  static async calculateTotalDiscount({ profile, coupons = [], vouchers = [], orderTotal = 0, shippingFee = 0 }) {
    let totalDiscountAmount = 0;
    const appliedDocs = [];
    const giftRequests = []; // [NEW] Danh sách quà tặng cần thêm vào đơn
    const now = new Date();

    logger.info(
      `[DEBUG] Calc Discount Start: OrderTotal=${orderTotal}, ShippingFee=${shippingFee}, Coupons=${coupons.length}, Vouchers=${vouchers.length}`
    );

    const calculateAmount = (valueType, value, maxDiscount, total, couponType) => {
      let amount = 0;

      // LOGIC XỬ LÝ FREESHIP
      if (couponType === 'freeship') {
        if (valueType === 'fixed_amount') {
          // Giảm cố định nhưng không vượt quá phí ship
          amount = Math.min(value, shippingFee);
        } else if (valueType === 'percentage') {
          // Giảm % phí ship (ví dụ 100% là miễn phí hoàn toàn)
          amount = Math.round(shippingFee * (value / 100));
        }

        logger.info(
          `[DEBUG] Freeship Logic: ValType=${valueType}, Val=${value}, ShipFee=${shippingFee} => Discount=${amount}`
        );
      }
      // LOGIC CÁC LOẠI KHÁC (discount_code, referral...)
      else if (valueType === 'percentage') {
        amount = Math.round(total * (value / 100));
      } else if (valueType === 'fixed_amount') {
        amount = value;
      }

      // Kiểm tra giới hạn giảm tối đa (chung cho cả freeship nếu có set maxDiscountAmount)
      if (maxDiscount && maxDiscount > 0) {
        amount = Math.min(amount, maxDiscount);
      }
      return amount;
    };

    // A. COUPONS (Bao gồm Referral & Gift)
    if (Array.isArray(coupons) && coupons.length > 0) {
      for (const c of coupons) {
        const doc = await Coupon.findOne({
          _id: c.id,
          code: c.code,
          status: 'ACTIVE',
          startDate: { $lte: now },
          endDate: { $gte: now },
        });

        if (!doc) {
          logger.warn(`Coupon invalid: ${c.code}`);
          continue;
        }

        // 2. Check Global Limit (Tổng hệ thống) - Có sẵn trong doc, check nhanh
        if (doc.maxUses > 0 && doc.usedCount >= doc.maxUses) {
          logger.warn(`Coupon max uses reached: ${doc.code}`);
          continue;
        }

        // 3. Check Min Order Amount - Check nhanh
        if (doc.minOrderAmount > 0 && orderTotal < doc.minOrderAmount) {
          logger.warn(`Coupon min order amount not met: ${doc.code}`);
          continue;
        }

        // 🔥 4. Check User Limit (Chỉ query DB khi cần thiết)
        if (doc.maxUsesPerUser > 0) {
          // Nếu coupon yêu cầu check limit mà không có user -> Bỏ qua (hoặc throw error tuỳ nghiệp vụ)
          if (!profile) {
            continue;
          }

          const profileId = profile._id || profile.id;

          // Sử dụng countDocuments sẽ nhẹ hơn aggregate trong trường hợp đếm đơn giản này
          const usedCount = await Order.countDocuments({
            profile: new mongoose.Types.ObjectId(profileId),
            status: { $nin: ['canceled', 'refunded'] }, // Không tính đơn huỷ
            'appliedCoupons.code': doc.code, // Chỉ đếm đúng mã này
          });

          if (usedCount >= doc.maxUsesPerUser) {
            // User đã hết lượt -> Bỏ qua coupon này
            continue;
          }
        }

        // Tính giảm giá tiền (nếu có)
        const amount = calculateAmount(doc.valueType, doc.value, doc.maxDiscountAmount, orderTotal, doc.type);
        totalDiscountAmount += amount;

        logger.info(`[DEBUG] Apply Coupon ${doc.code}: Type=${doc.type}, Amount=${amount}`);

        // [NEW] Thu thập Gift Items nếu có
        if (doc.giftItems && doc.giftItems.length > 0) {
          doc.giftItems.forEach((gift) => {
            giftRequests.push({
              item: gift.item,
              itemType: gift.itemType, // Product / Combo
              quantity: gift.quantity || 1,
              price: gift.price || 0, // Giá admin set (0 hoặc > 0)
              sourceCouponCode: doc.code,
            });
          });
        }

        appliedDocs.push({
          code: doc.code,
          name: doc.name || doc.code,
          ref: doc._id,
          refModel: 'Coupon',
          discountType: doc.valueType,
          discountValue: doc.value,
          amount,
        });
      }
    }

    // B. VOUCHERS
    if (Array.isArray(vouchers) && vouchers.length > 0) {
      for (const v of vouchers) {
        const doc = await Voucher.findOne({
          _id: v.voucherId,
          code: v.voucherCode,
          status: 'UNUSED',
        }).populate('coupon');

        if (!doc) continue;
        if (doc.expiredAt && new Date(doc.expiredAt) < now) continue;
        if (doc.coupon && doc.coupon.minOrderAmount > 0 && orderTotal < doc.coupon.minOrderAmount) continue;

        const snapshot = doc.discountSnapshot;
        const amount = calculateAmount(snapshot.type, snapshot.value, snapshot.maxDiscount, orderTotal);
        totalDiscountAmount += amount;

        logger.info(`[DEBUG] Apply Voucher ${doc.code}, Amount=${amount}`);

        // [NEW] Logic Gift cho Voucher (nếu voucher snapshot giữ info gift)
        // Hiện tại Voucher snapshot thường chỉ lưu value, nếu cần gift từ voucher phải populate sâu hơn
        // Ở đây giả định voucher follow theo coupon cha nếu coupon cha có gift
        if (doc.coupon && doc.coupon.giftItems && doc.coupon.giftItems.length > 0) {
          doc.coupon.giftItems.forEach((gift) => {
            giftRequests.push({
              item: gift.item,
              itemType: gift.itemType,
              quantity: gift.quantity || 1,
              price: gift.price || 0,
              sourceCouponCode: doc.code,
            });
          });
        }

        appliedDocs.push({
          code: doc.code,
          name: doc.coupon?.name || doc.code,
          ref: doc._id,
          refModel: 'Voucher',
          discountType: snapshot.type,
          discountValue: snapshot.value,
          amount,
        });
      }
    }

    totalDiscountAmount = Math.min(totalDiscountAmount, orderTotal);

    logger.info(`[DEBUG] Final Total Discount: ${totalDiscountAmount}`);

    return { appliedDocs, totalDiscountAmount, giftRequests };
  }

  /* ============================================================
   * 3. PREPARE DATA
   * ============================================================ */
  async prepareOrderData(payload, { useMenuPrice = true, isApplySurcharge = true } = {}) {
    const { orderType, profile, items, coupons = [], vouchers = [] } = payload;

    // 1. Build Regular Items
    const regularItems = useMenuPrice
      ? await OrderService.buildOrderItemsFromMenu(profile, items)
      : OrderService.buildOrderItemsFromSnapshot(items);

    // Tính tạm totalAmount của items thường để check điều kiện coupon
    const regularTotal = regularItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);

    const shippingFee = typeof payload.shippingFee === 'number' && orderType !== 'TakeAway' ? payload.shippingFee : 0;

    let calculatedSurchargeAmount = 0;
    let surcharges = [];
    let appliedSurcharges = [];

    if (orderType !== 'TakeAway' && isApplySurcharge) {
      surcharges = await Surcharge.find({ isActive: true });
      appliedSurcharges = surcharges.map((s) => {
        calculatedSurchargeAmount += s.cost;
        return { id: s._id, name: s.name, cost: s.cost };
      });

      logger.info(`[DEBUG] Surcharges Applied: ${JSON.stringify(appliedSurcharges)} | Total=${calculatedSurchargeAmount}`);
    }

    // 2. Calculate Discount & Get Gift Requests
    const { appliedDocs, totalDiscountAmount, giftRequests } = await OrderService.calculateTotalDiscount({
      profile,
      coupons,
      vouchers,
      orderTotal: regularTotal,
      shippingFee,
    });

    // 3. [NEW] Build Gift Items & Merge
    let finalOrderItems = [...regularItems];
    if (giftRequests && giftRequests.length > 0) {
      const giftItems = await OrderService.buildGiftItems(giftRequests);
      finalOrderItems = [...finalOrderItems, ...giftItems];
    }

    // 4. [UPDATE] Recalculate Total Amount (Bao gồm giá của Gift Items nếu có giá > 0)
    const finalTotalAmount = finalOrderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);

    // add log here
    logger.info(
      `Order Total Calculation: FinalTotalAmount=${finalTotalAmount}, TotalDiscount=${totalDiscountAmount}, ShippingFee=${shippingFee}, Surcharge=${calculatedSurchargeAmount}`
    );
    const grandTotal = Math.max(0, finalTotalAmount - totalDiscountAmount + shippingFee + calculatedSurchargeAmount);

    const orderCode = payload.orderCode || Date.now();
    const deliveryTime = payload.deliveryTime || { option: 'immediate', scheduledAt: null };

    const data = {
      ...payload,
      items: finalOrderItems, // Danh sách items bao gồm cả quà tặng
      appliedCoupons: appliedDocs,
      surcharges: appliedSurcharges, // Lưu chi tiết phụ thu vào đơn hàng
      surchargeAmount: calculatedSurchargeAmount, // Tổng tiền phụ thu
      totalAmount: finalTotalAmount, // Tổng tiền hàng (Regular + Gift)
      discountAmount: totalDiscountAmount,
      shippingFee,
      grandTotal,
      deliveryTime,
      orderCode,
      payment: { method: payload.payment?.method || 'cash', status: 'pending' },
      status: payload.status || 'pending',
    };

    if (data.payment.method === 'payos') {
      const qr = await this.generatePayOSQR({
        amount: grandTotal,
        orderCode,
        description: `Order #${orderCode}`,
      });
      data.payment.transactionId = qr.transactionId;
      data.payment.qrCode = qr.qrCode;
      data.payment.checkoutUrl = qr.checkoutUrl;
    }
    return data;
  }

  /* ============================================================
   * 4. UPDATE USAGE (ĐÃ CẬP NHẬT LOGIC TĂNG PARENT COUPON)
   * ============================================================ */
  static async updateDiscountsUsage(appliedDocs = []) {
    if (!appliedDocs || appliedDocs.length === 0) return;

    // A. Cập nhật Coupon Public (Tăng usedCount)
    const couponIds = appliedDocs.filter((d) => d.refModel === 'Coupon').map((d) => d.ref);

    if (couponIds.length > 0) {
      await Coupon.updateMany({ _id: { $in: couponIds } }, { $inc: { usedCount: 1 } });
    }

    // B. Cập nhật Voucher Cá Nhân
    const voucherDocs = appliedDocs.filter((d) => d.refModel === 'Voucher');
    const voucherIds = voucherDocs.map((d) => d.ref);

    if (voucherIds.length > 0) {
      // 1. Đánh dấu Voucher là USED
      await Voucher.updateMany(
        { _id: { $in: voucherIds } },
        {
          status: 'USED',
          usedAt: new Date(),
        }
      );

      // 🔥 2. TÌM VÀ TĂNG USED COUNT CHO COUPON GỐC (PARENT)
      // Lấy danh sách các Coupon ID từ các Voucher vừa dùng
      const usedVouchers = await Voucher.find({ _id: { $in: voucherIds } }).select('coupon');
      const parentCouponIds = usedVouchers.map((v) => v.coupon).filter((id) => !!id);

      if (parentCouponIds.length > 0) {
        await Coupon.updateMany({ _id: { $in: parentCouponIds } }, { $inc: { usedCount: 1 } });
      }
    }
  }

  static async updatePromotionUsage(orderItems) {
    const now = new Date();
    const promoItems = orderItems.filter((item) => item.promotion);
    if (promoItems.length === 0) return;

    await Promise.all(
      promoItems.map(async (item) => {
        return PricePromotion.updateOne({ _id: item.promotion }, [
          {
            $set: {
              usedQuantity: { $add: ['$usedQuantity', item.quantity] },
              dailyUsedCount: {
                $cond: {
                  if: {
                    $eq: [
                      { $dateToString: { format: '%Y-%m-%d', date: '$lastUsedDate' } },
                      { $dateToString: { format: '%Y-%m-%d', date: now } },
                    ],
                  },
                  then: { $add: ['$dailyUsedCount', item.quantity] },
                  else: item.quantity,
                },
              },
              lastUsedDate: now,
            },
          },
        ]);
      })
    );
  }

  /* ============================================================
   * 5. CONTROLLER ACTIONS
   * ============================================================ */
  async customerOrder(payload, user = null) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true, isApplySurcharge: true });
    const order = await this.model.create(orderData);

    try {
      await OrderService.updatePromotionUsage(orderData.items);
      await OrderService.updateDiscountsUsage(orderData.appliedCoupons);

      // --- [ADD] Ghi Log Tạo Đơn ---
      auditLogService.logChange({
        targetModel: 'Order',
        targetId: order._id,
        oldData: null,
        newData: order.toObject(),
        performer: user || payload.profile, // Nếu không có user object thì lấy ID profile
        action: 'CREATE',
        note: 'Khách hàng tạo đơn mới',
      });
    } catch (e) {
      logger.error('Error updating usage stats:', e);
    }

    try {
      // 1. Format nội dung: Tên, SĐT, Thời gian nhận
      const customerName = order.shipping?.address?.recipientName || 'Khách lẻ';
      const customerPhone = order.shipping?.address?.recipientPhone || '---';

      let deliveryTimeStr = '';
      if (order.deliveryTime?.option === 'scheduled' && order.deliveryTime?.scheduledAt) {
        // Format ngày giờ: 14:30 20/10/2023
        const date = new Date(order.deliveryTime.scheduledAt);

        // Format thủ công chuẩn: HH:mm dd/MM
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');

        deliveryTimeStr = `Giao lúc: ${hours}:${minutes} ${day}/${month}`;
      } else {
        deliveryTimeStr = `Giao ngay: ${new Date(order.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
      }

      const content = `Khách: ${customerName} - SĐT: ${customerPhone}. ${deliveryTimeStr}`;

      // 2. Tạo thông báo (Apply All Admin)
      await notificationService.createNotification({
        title: `Đơn hàng mới #${order.orderId}`,
        content,
        type: 'ORDER_NEW',
        referenceId: order._id || order.id,
        referenceModel: 'Order',
        isGlobal: true, // Gửi cho tất cả nhân viên
      });
      // -----------------------------
    } catch (error) {
      logger.error('Error creating order notification:', error);
    }

    return {
      message: orderData.payment.method === 'payos' ? 'Tạo đơn thành công, vui lòng quét QR.' : 'Tạo đơn thành công.',
      order,
      qrInfo: orderData.payment.method === 'payos' ? { checkoutUrl: orderData.payment.checkoutUrl } : null,
    };
  }

  /* ============================================================
   * 6. UPDATE PROFILE STATS (LOGIC MỚI)
   * ============================================================ */
  static async updateProfileStats(order) {
    // Chỉ xử lý khi đơn hàng đã hoàn thành và có thông tin profile
    if (order.status !== 'completed' || !order.profile || !order.profileType) {
      return;
    }

    const updateData = {
      $inc: {
        totalOrder: 1,
        totalSpent: order.grandTotal, // Cộng dồn tổng tiền thực trả của đơn hàng
      },
      $set: {
        lastOrderDate: new Date(), // Cập nhật ngày đặt hàng gần nhất là hiện tại
      },
    };

    try {
      if (order.profileType === 'Customer') {
        // Cập nhật cho chính khách hàng
        await Customer.findByIdAndUpdate(order.profile, updateData);

        // --- LOGIC REFERRAL ---
        // Kiểm tra xem khách này có được mời bởi ai không
        const customer = await Customer.findById(order.profile);
        if (customer && customer.referredBy) {
          // Kiểm tra đã có đơn thành công trước đó chưa
          const orderCount = await Order.countDocuments({
            profile: customer._id,
            profileType: 'Customer',
            status: 'completed',
          });
          if (orderCount === 1) {
            // Đơn đầu tiên thành công
            // Tăng referrerSuccessfulInvites cho người giới thiệu
            const inviteLog = { customer: customer._id, at: new Date() };
            await Customer.findByIdAndUpdate(customer.referredBy, {
              $inc: { referrerSuccessfulInvites: 1 },
            });
            // Lưu thời điểm referralCode được tính ở User B (chỉ 1 field)
            await Customer.findByIdAndUpdate(customer._id, {
              $set: { referralCodeSuccessAt: inviteLog.at },
            });
          }
        }
      } else if (order.profileType === 'Employee') {
        await Employee.findByIdAndUpdate(order.profile, updateData);
      }
    } catch (error) {
      logger.error(`Failed to update profile stats for order ${order.orderCode}:`, error);
    }
  }

  async adminPanelCreateOrder(payload, user = null) {
    const orderData = await this.prepareOrderData(payload, { useMenuPrice: true, isApplySurcharge: false });
    const order = await this.model.create(orderData);

    // --- [ADD] Ghi Log Admin Tạo Đơn ---
    auditLogService.logChange({
      targetModel: 'Order',
      targetId: order._id,
      oldData: null,
      newData: order.toObject(),
      performer: user,
      action: 'CREATE',
      note: 'Admin tạo đơn thủ công',
    });

    return { message: 'Admin đã tạo đơn thành công.', order };
  }

  async adminPanelUpdateOrder(id, payload, user = null) {
    const existing = await this.model.findById(id);
    if (!existing) throw new Error('Order không tồn tại');

    // Snapshot dữ liệu cũ để ghi log
    const oldOrderSnapshot = existing.toObject();

    // 1. Khởi tạo updateDoc từ payload (Mặc định cập nhật những gì gửi lên)
    const updateDoc = { ...payload };

    // Cờ đánh dấu cần tính lại GrandTotal
    let shouldRecalculateGrandTotal = false;

    // Helper: Lấy giá trị ưu tiên từ updateDoc (nếu có thay đổi), ngược lại lấy từ existing
    const getVal = (key) => (key in updateDoc ? updateDoc[key] : existing[key]);

    // 2. Xử lý ITEMS (Nếu có gửi items mới)
    if (payload.items && Array.isArray(payload.items)) {
      const orderItems = OrderService.buildOrderItemsFromSnapshot(payload.items);
      updateDoc.items = orderItems;
      // Tính lại tổng tiền hàng
      updateDoc.totalAmount = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);
      shouldRecalculateGrandTotal = true;
    }

    // 3. Xử lý PROMOTION (Nếu có gửi coupons hoặc vouchers)
    if (payload.coupons || payload.vouchers) {
      const coupons = payload.coupons || [];
      const vouchers = payload.vouchers || [];
      // Lấy totalAmount hiện tại (mới hoặc cũ) để tính giảm giá
      const currentOrderTotal = getVal('totalAmount');

      const result = await OrderService.calculateTotalDiscount({
        coupons,
        vouchers,
        orderTotal: currentOrderTotal,
      });

      updateDoc.appliedCoupons = result.appliedDocs;
      updateDoc.discountAmount = result.totalDiscountAmount;
      shouldRecalculateGrandTotal = true;
    }

    // 4. Xử lý PAYMENT (Merge object thay vì ghi đè nếu muốn giữ data cũ trong payment)
    if (payload.payment) {
      updateDoc.payment = { ...existing.payment, ...payload.payment };
    }

    // 5. Kiểm tra các thay đổi về phí ship hoặc phụ thu để trigger tính lại GrandTotal
    if ('shippingFee' in payload || 'surchargeAmount' in payload) {
      shouldRecalculateGrandTotal = true;
    }

    // 6. Tính toán lại GRAND TOTAL (Chỉ chạy khi các thành phần giá thay đổi)
    if (shouldRecalculateGrandTotal) {
      const total = getVal('totalAmount') || 0;
      const discount = getVal('discountAmount') || 0;
      const ship = getVal('shippingFee') || 0;
      const surcharge = getVal('surchargeAmount') || 0;

      updateDoc.grandTotal = Math.max(0, total - discount + ship + surcharge);
    }

    // Thực hiện Update
    const order = await this.model.findByIdAndUpdate(id, updateDoc, { new: true });

    // Trigger thống kê nếu trạng thái đổi sang completed
    if (payload.status === 'completed' && existing.status !== 'completed') {
      await OrderService.updateProfileStats(order);
    }

    // --- [NEW] GỬI THÔNG BÁO CHO KHÁCH HÀNG KHI TRẠNG THÁI THAY ĐỔI ---
    if (payload.status && payload.status !== existing.status) {
      try {
        const userId = await this._getUserIdFromProfile(order);
        if (userId) {
          // 1. Khi chuyển sang PREPARING (Đã xác nhận & Đang chuẩn bị)
          if (order.status === 'preparing') {
            await notificationService.createNotification({
              title: `Đơn hàng #${order.orderId} đang chuẩn bị`,
              content: `Đơn hàng #${order.orderId} của bạn đã được xác nhận và Bếp đang chuẩn bị đơn.`,
              type: 'ORDER_STATUS_UPDATE',
              referenceId: order._id,
              referenceModel: 'Order',
              receivers: [userId],
            });
          }

          // 2. Khi chuyển sang DELIVERING (Đang giao hàng)
          if (order.status === 'delivering') {
            await notificationService.createNotification({
              title: `Đơn hàng #${order.orderId} đang giao`,
              content: `Đơn hàng đang trên đường giao tới, bạn để ý điện thoại giúp chúng mình nhé.`,
              type: 'ORDER_STATUS_UPDATE',
              referenceId: order._id,
              referenceModel: 'Order',
              receivers: [userId],
            });
          }

          if (order.status === 'completed') {
            await notificationService.createNotification({
              title: `Đơn hàng #${order.orderId} đã hoàn tất`,
              content: `Lưu Chi vừa gửi cà phê đến bạn. Chúc bạn thưởng thức thật trọn vẹn 🤎`,
              type: 'ORDER_STATUS_UPDATE',
              referenceId: order._id,
              referenceModel: 'Order',
              receivers: [userId],
            });
          }
        }
      } catch (err) {
        logger.error(`Failed to send status notification for order ${order.orderId}:`, err);
      }
    }
    // ------------------------------------------------------------------

    // Ghi Log Audit And Socket Emit
    try {
      emitOrderUpdate(order);

      await auditLogService.logChange({
        targetModel: 'Order',
        targetId: order._id,
        oldData: oldOrderSnapshot,
        newData: order.toObject(),
        performer: user,
        action: 'UPDATE',
        note: payload.noteChange || '',
      });
    } catch (logErr) {
      logger.error(`Failed to log order update for ${id}:`, logErr);
    }

    return { message: 'Cập nhật đơn hàng thành công.', order };
  }

  async generatePayOSQR({ amount, orderCode, description }) {
    const result = await this.payos.paymentRequests.create({
      amount,
      orderCode,
      description,
      returnUrl: config.payos.redirect_payment_success,
      cancelUrl: config.payos.redirect_payment_cancel,
    });
    const data = result.data || result;
    return {
      transactionId: data.id || data.transactionId,
      qrCode: data.qrCode,
      checkoutUrl: data.checkoutUrl || data.shortLink,
    };
  }

  static findById(id) {
    return this.model.findById(id);
  }

  async scanAndHandlePendingOrders() {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // Mốc 10 phút
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000); // Mốc 20 phút

    logger.info(`[Cron] Running order scanAndHandlePendingOrders at ${now.toISOString()}...`);

    // ---------------------------------------------------------
    // 1. XỬ LÝ TỰ ĐỘNG HUỶ ĐƠN ( > 20 phút chưa thanh toán )
    // ---------------------------------------------------------
    const expiredOrders = await this.model.find({
      status: 'pending', // Đơn đang chờ
      'payment.status': 'pending', // Chưa thanh toán
      'payment.method': {
        $ne: 'cash',
      },
      createdAt: { $lte: twentyMinutesAgo }, // Tạo trước 20 phút
    });

    for (const order of expiredOrders) {
      // a. Cập nhật trạng thái đơn
      order.status = 'canceled';
      order.payment.status = 'failed';
      order.note = `${order.note || ''}\n[Hệ Thống] Huỷ tự động do quá hạn thanh toán (20p).`;
      await order.save();

      // b. Tìm User ID để gửi thông báo
      const userId = await this._getUserIdFromProfile(order);

      if (userId) {
        // c. Tạo thông báo + Bắn Socket
        await notificationService.createNotification({
          title: 'Đơn hàng đã bị huỷ',
          content:
            'Trong trường hợp chưa nhận được xác nhận đặt đơn từ bạn, bếp Lưu Chi xin phép huỷ đơn để đảm bảo tiến độ phục vụ. Rất mong được đón tiếp bạn trong lần đặt đơn tiếp theo ạ',
          type: 'ORDER_CANCELED_AUTO', // Type riêng để dễ tracking
          referenceId: order._id,
          referenceModel: 'Order',
          receivers: [userId],
        });
      }

      // d. Bắn Socket cập nhật trạng thái đơn hàng (Realtime UI update)
      emitOrderUpdate(order);
      logger.info(`[Cron] Auto-canceled Order #${order.orderCode}`);
    }

    // ---------------------------------------------------------
    // 2. XỬ LÝ NHẮC NHỞ THANH TOÁN ( > 10 phút và < 20 phút )
    // ---------------------------------------------------------
    const reminderOrders = await this.model.find({
      status: 'pending',
      'payment.status': 'pending',
      'payment.method': {
        $ne: 'cash',
      },
      createdAt: {
        $lte: tenMinutesAgo,
        $gt: twentyMinutesAgo,
      },
    });

    for (const order of reminderOrders) {
      // Kiểm tra xem đã gửi thông báo nhắc nhở cho đơn này chưa (tránh spam)
      const existingNotif = await Notification.findOne({
        referenceId: order._id,
        type: 'ORDER_PAYMENT_REMINDER',
      });

      if (!existingNotif) {
        const userId = await this._getUserIdFromProfile(order);

        if (userId) {
          await notificationService.createNotification({
            title: 'Nhắc nhở thanh toán',
            content: 'Dạ, quý khách vui lòng hoàn tất thanh toán để bếp có thể chuẩn bị đơn kịp thời ạ.',
            type: 'ORDER_PAYMENT_REMINDER',
            referenceId: order._id,
            referenceModel: 'Order',
            receivers: [userId],
          });
          logger.info(`[Cron] Reminded payment for Order #${order.orderCode}`);
        }
      }
    }
  }

  // Helper nội bộ để lấy User ID từ Profile
  async _getUserIdFromProfile(order) {
    if (!order.profile) return null;
    let userId = null;
    try {
      if (order.profileType === 'Customer') {
        const cus = await Customer.findById(order.profile);
        if (cus) userId = cus.user;
      } else if (order.profileType === 'Employee') {
        const emp = await Employee.findById(order.profile);
        if (emp) userId = emp.user;
      }
    } catch (e) {
      logger.error(`Error fetching user from profile ${order.profile}: ${e.message}`);
    }
    return userId;
  }

  /* ============================================================
   * [UPDATED] CRONJOB: QUÉT ĐƠN ĐẶT LỊCH (HỖ TRỢ ĐƠN GẤP)
   * ============================================================ */
  async scanAndNotifyUpcomingOrders() {
    const now = new Date();

    logger.info(`[Cron] Running order scanAndNotifyUpcomingOrders at ${now.toISOString()}...`);

    // 1. Định nghĩa các mốc thời gian giới hạn (Thresholds)
    // Thay vì check đúng phút, ta check khoảng: "Giao từ bây giờ đến X phút nữa"

    // Mốc 45 phút cho việc chuẩn bị
    const prepDeadline = moment(now).add(45, 'minutes').toDate();

    // Mốc 20 phút cho việc gọi ship
    const shipDeadline = moment(now).add(20, 'minutes').toDate();

    // 2. [TASK 1] NHẮC NHỞ CHUẨN BỊ (Trong vòng 45p tới)
    // Tìm đơn: Scheduled + (Confirmed/Preparing) + Chưa quá hạn giao + Nằm trong 45p tới
    const prepOrders = await this.model.find({
      status: { $in: ['confirmed', 'preparing'] },
      'deliveryTime.option': 'scheduled',
      priorityTime: {
        // $gt: now, // Đơn chưa quá giờ giao (vẫn còn trong tương lai)
        $lte: prepDeadline, // Giao trong vòng 45 phút nữa
      },
    });

    logger.info(`prepOrders -- ${JSON.stringify(prepOrders)}`);

    for (const order of prepOrders) {
      // Quan trọng: Kiểm tra xem đã gửi thông báo này chưa để tránh spam mỗi phút
      const exists = await Notification.findOne({
        referenceId: order._id,
        type: 'ADMIN_REMINDER_PREP',
      });

      if (!exists) {
        const timeStr = moment(order.priorityTime).utcOffset(7).format('HH:mm DD/MM');
        await notificationService.createNotification({
          title: `⚠️ Nhắc nhở: Chuẩn bị đơn #${order.orderId}`,
          content: `Đơn đặt lịch #${order.orderId} giao lúc ${timeStr} (còn < 45p). Bếp vui lòng kiểm tra và chuẩn bị món.`,
          type: 'ADMIN_REMINDER_PREP',
          referenceId: order._id,
          referenceModel: 'Order',
          isGlobal: true,
        });
        logger.info(`[Cron] Sent Prep Reminder for Order #${order.orderId}`);
      }
    }

    // 3. [TASK 2] NHẮC NHỞ GỌI SHIP (Trong vòng 20p tới)
    const shipOrders = await this.model.find({
      status: { $in: ['confirmed', 'preparing', 'ready'] },
      'deliveryTime.option': 'scheduled',
      priorityTime: {
        $gt: now,
        $lte: shipDeadline, // Giao trong vòng 20 phút nữa
      },
    });

    logger.info(`shipOrders -- ${JSON.stringify(shipOrders)}`);

    for (const order of shipOrders) {
      const exists = await Notification.findOne({
        referenceId: order._id,
        type: 'ADMIN_REMINDER_SHIP',
      });

      if (!exists) {
        const timeStr = moment(order.priorityTime).utcOffset(7).format('HH:mm DD/MM');
        await notificationService.createNotification({
          title: `🚀 Nhắc nhở: Gọi ship đơn #${order.orderId}`,
          content: `Đơn đặt lịch #${order.orderId} giao lúc ${timeStr} (còn < 20p). Vui lòng đặt tài xế ngay.`,
          type: 'ADMIN_REMINDER_SHIP',
          referenceId: order._id,
          referenceModel: 'Order',
          isGlobal: true,
        });
        logger.info(`[Cron] Sent Ship Reminder for Order #${order.orderId}`);
      }
    }
  }
}

module.exports = new OrderService();
