const httpStatus = require('http-status');
const { productService, comboService, pricePromotionService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;
const IMAGE_PREFIX = 'http://localhost:3000';

// ===========================
// HELPER: TÍNH GIÁ PROMOTION
// ===========================
const calculateSalePrice = (basePrice, promotion) => {
  if (!promotion) return null;

  let salePrice;
  if (promotion.discountType === 'percentage') {
    const discountAmount = (basePrice * promotion.discountValue) / 100;
    salePrice = basePrice - discountAmount;
  } else if (promotion.discountType === 'fixed_amount') {
    salePrice = basePrice - promotion.discountValue;
  } else {
    return null;
  }

  return Math.max(0, salePrice);
};

// ===========================
// HELPER: XÂY CATEGORY + FLASH SALE (TÁCH RIÊNG)
// ===========================
const buildMenuCategories = (productResults, productPromoMap) => {
  const categoryMap = new Map();
  const flashSaleProducts = [];

  for (const product of productResults) {
    if (!product.category || !product.category.isActive) continue;

    // --- CREATE CATEGORY OBJECT ---
    const catId = product.category._id.toString();
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        id: product.category._id,
        name: product.category.name,
        priority: product.category.priority || 0,
        products: [],
      });
    }

    // --- CLEAN PRODUCT OBJECT ---
    const { category, _id, __v, ...rest } = product.toObject();
    const productData = {
      id: _id,
      ...rest,
      image: rest.image ? `${IMAGE_PREFIX}${rest.image}` : '',
    };

    // --- PROMOTION APPLY ---
    const promotion = productPromoMap.get(productData.id.toString());
    if (promotion) {
      productData.promotion = promotion.id || promotion._id;
      productData.salePrice = calculateSalePrice(productData.basePrice, promotion);
      flashSaleProducts.push(productData);
    }

    // --- PUSH INTO CATEGORY ---
    categoryMap.get(catId).products.push(productData);
  }

  const regularCategories = Array.from(categoryMap.values()).sort((a, b) => a.priority - b.priority);

  return { regularCategories, flashSaleProducts };
};

// ===========================
// CONTROLLER
// ===========================
class MenuController {
  constructor() {
    this.getMenu = catchAsync(this.getMenu.bind(this));
  }

  /**
   * @route GET /api/v1/menu
   */
  async getMenu(req, res) {
    const now = new Date();

    // Filters
    const activeQuery = { isActive: true };
    const activePromoQuery = { isActive: true, endDate: { $gte: now } };
    const activeComboQuery = { isActive: true, endDate: { $gte: now } };

    // Fetch song song
    const [promoData, productData, comboData] = await Promise.all([
      pricePromotionService.findAll(activePromoQuery, {
        populate: 'product,combo',
        sortBy: 'priority,createdAt:desc',
      }),
      productService.findAll(activeQuery, {
        populate: 'category',
        sortBy: 'category.priority,priority',
      }),
      comboService.findAll(activeComboQuery, {
        sortBy: 'priority',
        populate: 'items.selectableProducts.product',
      }),
    ]);

    // Filter flashSales
    const flashSales = promoData.filter((promo) => promo.product || promo.combo);

    // Build promotion maps
    const productPromoMap = new Map();
    const comboPromoMap = new Map();

    for (const promo of flashSales) {
      if (promo.product) {
        const productId = promo.product.toString();
        if (!productPromoMap.has(productId)) {
          productPromoMap.set(productId, promo.toObject());
        }
      }
      if (promo.combo) {
        const comboId = promo.combo.toString();
        if (!comboPromoMap.has(comboId)) {
          comboPromoMap.set(comboId, promo.toObject());
        }
      }
    }

    // --------------------------
    // BUILD MENU CATEGORY
    // --------------------------
    const { regularCategories, flashSaleProducts } = buildMenuCategories(productData, productPromoMap);

    // FLASH SALE CATEGORY TÁCH RIÊNG
    const flashSaleCategory =
      flashSaleProducts.length > 0
        ? {
            id: 'flash_sale_category',
            name: 'Flash Sale',
            priority: -999,
            products: flashSaleProducts,
          }
        : null;

    // --------------------------
    // BUILD COMBOS
    // --------------------------
    const combos = comboData.map((combo) => {
      const { _id, __v, ...rest } = combo.toObject();
      const comboObj = {
        id: _id,
        ...rest,
        image: rest.image ? `${IMAGE_PREFIX}${rest.image}` : '',
      };

      const promotion = comboPromoMap.get(comboObj.id.toString());
      if (promotion) {
        comboObj.promotion = promotion;
        comboObj.salePrice = calculateSalePrice(comboObj.comboPrice, promotion);
      }

      if (comboObj.items && comboObj.items.length) {
        comboObj.items.forEach((slot) => {
          if (slot.selectableProducts) {
            slot.selectableProducts.forEach((p) => {
              if (p.product) {
                p.product.id = p.product.id || p.product._id;
              }
            });
          }
        });
      }

      return comboObj;
    });

    // --------------------------
    // RESPONSE
    // --------------------------
    res.status(OK).json({
      flashSales, // danh sách khuyến mãi raw
      flashSaleCategory, // FLASH SALE CATEGORY (riêng)
      thucDon: regularCategories, // MENU CATEGORY BÌNH THƯỜNG
      combos, // combo
    });
  }
}

module.exports = new MenuController();
