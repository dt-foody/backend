// src/controllers/menu.controller.js
const httpStatus = require('http-status');
const { productService, comboService, pricePromotionService } = require('../services');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');

const { OK } = httpStatus;
const IMAGE_PREFIX = config.backendUrl;

class MenuController {
  constructor() {
    this.getMenu = catchAsync(this.getMenu.bind(this));
  }

  /**
   * Helper: Extract safe string ID from Populated Object or Raw ID
   */
  getItemId(item) {
    if (!item) return null;
    if (typeof item === 'object') {
      // Prioritize 'id' (virtual/plugin), fallback to '_id'
      return item.id || item._id?.toString();
    }
    return item.toString();
  }

  /**
   * Helper: Calculate final price based on discount type
   */
  calculateSalePrice(basePrice, promotion) {
    if (!promotion) return basePrice;

    let salePrice = basePrice;
    const { discountType, discountValue, maxDiscountAmount } = promotion;

    if (discountType === 'percentage') {
      // 1. Tính số tiền được giảm theo phần trăm
      let discountAmount = basePrice * (discountValue / 100);

      // 2. Nếu có cấu hình giảm tối đa (maxDiscountAmount > 0) thì kiểm tra trần
      if (maxDiscountAmount && maxDiscountAmount > 0) {
        if (discountAmount > maxDiscountAmount) {
          discountAmount = maxDiscountAmount;
        }
      }

      // 3. Trừ tiền giảm vào giá gốc
      salePrice = basePrice - discountAmount;
    } else if (discountType === 'fixed_amount') {
      salePrice = basePrice - discountValue;
    }

    return Math.max(0, Math.round(salePrice));
  }

  /**
   * Helper: Validate promotion limits
   */
  isValidPromotion(promo, startOfDay) {
    // 1. Global Limit
    if (promo.maxQuantity > 0 && promo.usedQuantity >= promo.maxQuantity) {
      return false;
    }

    // 2. Daily Limit
    let currentDailyCount = promo.dailyUsedCount || 0;
    if (promo.lastUsedDate && new Date(promo.lastUsedDate) < startOfDay) {
      currentDailyCount = 0;
    }

    if (promo.dailyMaxUses > 0 && currentDailyCount >= promo.dailyMaxUses) {
      return false;
    }

    return true;
  }

  async getMenu(req, res) {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Fetch Data in Parallel
    const [rawPromotions, products, combos] = await Promise.all([
      pricePromotionService.findAll(
        {
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        },
        {
          populate: 'product,combo',
          sortBy: 'priority:desc,createdAt:desc',
        }
      ),
      productService.findAll({ isActive: true }, { populate: 'category', sortBy: 'category.priority,priority' }),
      comboService.findAll(
        { isActive: true, endDate: { $gte: now } },
        { sortBy: 'priority', populate: 'items.selectableProducts.product' }
      ),
    ]);

    // 2. Build Promotion Maps
    const productPromoMap = new Map();
    const comboPromoMap = new Map();

    for (const promo of rawPromotions) {
      if (!this.isValidPromotion(promo, startOfDay)) continue;

      // Map for Product
      const pId = promo.product && promo.product.toString();
      if (pId && !productPromoMap.has(pId)) {
        productPromoMap.set(pId, promo);
      }

      // Map for Combo
      const cId = promo.combo && promo.combo.toString();
      if (cId && !comboPromoMap.has(cId)) {
        comboPromoMap.set(cId, promo);
      }
    }

    // 3. Process Products & Categories (UPDATED LOGIC HERE)
    const categoryMap = new Map();
    const flashSaleItems = [];

    for (const product of products) {
      if (!product.category || !product.category.isActive) continue;

      const pObj = product.toObject(); // Plugin ensures pObj.id exists
      const productId = pObj.id.toString();

      // --- A. TẠO ITEM CHO DANH MỤC THƯỜNG (LUÔN LÀ GIÁ GỐC) ---
      // Item này sẽ được push vào categoryMap bên dưới
      const regularItem = {
        ...pObj,
        image: pObj.image ? `${IMAGE_PREFIX}${pObj.image}` : '',
        salePrice: pObj.basePrice, // Cố định giá bán bằng giá gốc
        promotion: null, // Không kèm thông tin promotion
      };

      // --- B. XỬ LÝ LOGIC FLASH SALE (TÁCH BIỆT) ---
      const promo = productPromoMap.get(productId);
      if (promo) {
        // Tính toán giá giảm thử nghiệm
        const calculatedSalePrice = this.calculateSalePrice(regularItem.basePrice, promo);

        // Nếu có giảm giá thật sự thì mới tạo object Flash Sale riêng
        if (calculatedSalePrice < regularItem.basePrice) {
          const flashSaleItem = {
            ...regularItem, // Copy thông tin cơ bản
            type: 'Product',
            salePrice: calculatedSalePrice, // Áp dụng giá giảm
            promotion: {
              // Kèm thông tin khuyến mãi
              id: this.getItemId(promo).toString(),
              name: promo.name,
              discountType: promo.discountType,
              discountValue: promo.discountValue,
              maxDiscountAmount: promo.maxDiscountAmount || 0,
            },
          };

          // Push item đã giảm giá vào danh sách Flash Sale
          flashSaleItems.push(flashSaleItem);
        }
      }

      // --- C. PUSH ITEM GIÁ GỐC VÀO DANH MỤC ---
      const catId = this.getItemId(product.category);
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: product.category.name,
          priority: product.category.priority || 0,
          products: [],
        });
      }

      // Quan trọng: Push regularItem (giá gốc), KHÔNG push flashSaleItem
      categoryMap.get(catId).products.push(regularItem);
    }

    const regularCategories = Array.from(categoryMap.values()).sort((a, b) => a.priority - b.priority);

    // 4. Process Combos (Giữ nguyên vì Combo được hiển thị ở section riêng)
    const processedCombos = combos.map((combo) => {
      const cObj = combo.toObject(); // Plugin ensures cObj.id exists
      const comboId = cObj.id.toString();

      const comboData = {
        ...cObj,
        image: cObj.image ? `${IMAGE_PREFIX}${cObj.image}` : '',
        basePrice: cObj.comboPrice,
        salePrice: cObj.comboPrice,
        promotion: null,
        items: cObj.items || [],
      };

      // Apply Promotion
      const promo = comboPromoMap.get(comboId);
      if (promo) {
        comboData.salePrice = this.calculateSalePrice(comboData.comboPrice, promo);
        comboData.promotion = {
          id: this.getItemId(promo),
          name: promo.name,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
        };

        if (comboData.salePrice < comboData.basePrice) {
          flashSaleItems.push({ ...comboData, type: 'Combo' });
        }
      }

      return comboData;
    });

    // 5. Construct Final Response
    const flashSaleCategory =
      flashSaleItems.length > 0
        ? {
            id: 'flashsale',
            name: 'Flash Sale',
            priority: -999,
            products: flashSaleItems,
          }
        : null;

    res.status(OK).json({
      flashSaleCategory, // Chứa các món (Sản phẩm & Combo) CÓ giảm giá
      thucDon: regularCategories, // Chứa Sản phẩm GIÁ GỐC
      combos: processedCombos, // Chứa Combo CÓ giảm giá (theo yêu cầu ban đầu)
    });
  }
}

module.exports = new MenuController();
