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
    console.log("promotion", basePrice, promotion);
    if (!promotion) return basePrice;

    let salePrice = basePrice;
    const { discountType, discountValue } = promotion;

    if (discountType === 'percentage') {
      salePrice = basePrice * (1 - discountValue / 100);
    } else if (discountType === 'fixed_amount') {
      salePrice = basePrice - discountValue;
    }
    console.log("salePrice", salePrice);

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

    console.log("rawPromotions", rawPromotions);

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

    console.log("comboPromoMap", comboPromoMap);

    // 3. Process Products & Categories
    const categoryMap = new Map();
    const flashSaleItems = [];

    for (const product of products) {
      if (!product.category || !product.category.isActive) continue;

      const pObj = product.toObject(); // Plugin ensures pObj.id exists
      const productId = pObj.id.toString();

      // Prepare Base Item Data
      const itemData = {
        ...pObj,
        image: pObj.image ? `${IMAGE_PREFIX}${pObj.image}` : '',
        salePrice: pObj.basePrice,
        promotion: null,
      };

      // Apply Promotion
      const promo = productPromoMap.get(productId);
      if (promo) {
        itemData.salePrice = this.calculateSalePrice(itemData.basePrice, promo);
        itemData.promotion = {
          id: this.getItemId(promo).toString(), // Ensure ID string
          name: promo.name,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
        };

        if (itemData.salePrice < itemData.basePrice) {
          flashSaleItems.push({ ...itemData, type: 'Product' });
        }
      }

      // Group by Category
      const catId = this.getItemId(product.category);
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: product.category.name,
          priority: product.category.priority || 0,
          products: [],
        });
      }
      categoryMap.get(catId).products.push(itemData);
    }

    const regularCategories = Array.from(categoryMap.values()).sort((a, b) => a.priority - b.priority);

    // 4. Process Combos
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
            id: 'flash-sale',
            name: 'Flash Sale',
            priority: -999,
            products: flashSaleItems,
          }
        : null;

    res.status(OK).json({
      flashSaleCategory,
      thucDon: regularCategories,
      combos: processedCombos,
    });
  }
}

module.exports = new MenuController();
