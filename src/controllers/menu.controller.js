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
   * Helper: Tính giá sau giảm
   * [FIX] Update logic check discountType để khớp với data
   */
  calculateSalePrice(basePrice, promotion) {
    if (!promotion) return basePrice;

    let salePrice = basePrice;

    // Chấp nhận cả 'percentage'
    if (promotion.discountType === 'percentage') {
      salePrice = basePrice * (1 - promotion.discountValue / 100);
    } else if (promotion.discountType === 'fixed_amount') {
      salePrice = basePrice - promotion.discountValue;
    }

    return Math.max(0, salePrice);
  }

  isValidPromotion(promo, startOfDay) {
    // 1. Check Global Limit
    if (promo.maxQuantity > 0 && promo.usedQuantity >= promo.maxQuantity) return false;

    // 2. Check Daily Limit
    let currentDailyCount = promo.dailyUsedCount;
    if (promo.lastUsedDate && promo.lastUsedDate < startOfDay) {
      currentDailyCount = 0;
    }
    if (promo.dailyMaxUses > 0 && currentDailyCount >= promo.dailyMaxUses) return false;

    return true;
  }

  /**
   * Helper: Lấy ID an toàn từ field product/combo
   * [FIX] Hàm mới để xử lý trường hợp populate thất bại hoặc trả về ID raw
   */
  getItemId(item) {
    if (!item) return null;
    // Nếu là object có _id (đã populate) -> lấy ._id
    if (item._id) return item._id.toString();
    // Nếu là object có id (đã toJSON) -> lấy .id
    if (item.id) return item.id.toString();
    // Nếu bản thân nó là string/ObjectId -> trả về chính nó
    return item.toString();
  }

  async getMenu(req, res) {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

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

    // --- BUILD MAP ---
    const productPromoMap = new Map();
    const comboPromoMap = new Map();

    for (const promo of rawPromotions) {
      if (!this.isValidPromotion(promo, startOfDay)) continue;

      // [FIX] Dùng hàm getItemId để lấy ID chính xác
      if (promo.product) {
        const pId = this.getItemId(promo.product);
        if (pId && !productPromoMap.has(pId)) {
          productPromoMap.set(pId, promo);
        }
      }

      if (promo.combo) {
        const cId = this.getItemId(promo.combo);
        if (cId && !comboPromoMap.has(cId)) {
          comboPromoMap.set(cId, promo);
        }
      }
    }

    // --- BUILD PRODUCTS ---
    const categoryMap = new Map();
    const flashSaleItems = [];

    for (const product of products) {
      if (!product.category || !product.category.isActive) continue;

      const pObj = product.toObject();
      const productId = pObj._id.toString();

      const itemData = {
        id: productId,
        name: pObj.name,
        description: pObj.description,
        image: pObj.image ? `${IMAGE_PREFIX}${pObj.image}` : '',
        basePrice: pObj.basePrice,
        salePrice: pObj.basePrice, // Default
        promotion: null,
        options: pObj.options || [],
      };

      // Check Promotion
      const promo = productPromoMap.get(productId);
      if (promo) {
        itemData.salePrice = this.calculateSalePrice(itemData.basePrice, promo);
        itemData.promotion = {
          id: promo._id,
          name: promo.name,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
        };

        // Chỉ push vào flash sale nếu thực sự có giảm giá
        if (itemData.salePrice < itemData.basePrice) {
          flashSaleItems.push(itemData);
        }
      }

      const catId = product.category._id.toString();
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

    // --- BUILD COMBOS ---
    const processedCombos = combos.map((combo) => {
      const cObj = combo.toObject();
      const comboId = cObj._id.toString();

      const comboData = {
        id: comboId,
        name: cObj.name,
        description: cObj.description,
        image: cObj.image ? `${IMAGE_PREFIX}${cObj.image}` : '',
        basePrice: cObj.comboPrice,
        salePrice: cObj.comboPrice,
        promotion: null,
        items: cObj.items || [],
      };

      const promo = comboPromoMap.get(comboId);
      if (promo) {
        comboData.salePrice = this.calculateSalePrice(comboData.basePrice, promo);
        comboData.promotion = {
          id: promo._id,
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
