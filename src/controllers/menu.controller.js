const httpStatus = require('http-status');
const { productService, comboService, pricePromotionService, orderService, dealSettingService } = require('../services');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');

const { OK } = httpStatus;
const IMAGE_PREFIX = config.backendUrl;

let publicMenuCache = { data: null, timestamp: 0 };

class MenuController {
  constructor() {
    this.getMenu = catchAsync(this.getMenu.bind(this));
  }

  getItemId(item) {
    if (typeof item === 'string') {
      return item;
    }
    if (item && item._id) {
      return item._id.toString();
    }
    if (item && item.id) {
      return item.id.toString();
    }
    if (item) {
      return item.toString();
    }
    return null;
  }

  isPromoValidGlobally(promo, startOfDay) {
    if (promo.maxQuantity > 0 && promo.usedQuantity >= promo.maxQuantity) return false;
    if (promo.dailyMaxUses > 0) {
      let dailyCount = promo.dailyUsedCount || 0;
      if (promo.lastUsedDate && new Date(promo.lastUsedDate) < startOfDay) dailyCount = 0;
      if (dailyCount >= promo.dailyMaxUses) return false;
    }
    return true;
  }

  async getMenu(req, res) {
    const { user, profile } = req;
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    if (!user && publicMenuCache.data && now - publicMenuCache.timestamp < 60000) {
      return res.status(OK).json(publicMenuCache.data);
    }

    const [rawPromotions, products, combos, dealSetting] = await Promise.all([
      pricePromotionService.findAll(
        { isActive: true, startDate: { $lte: now }, endDate: { $gte: now } },
        { sortBy: 'priority:desc' }
      ),
      productService.findAll({ isActive: true }, { populate: 'category', sortBy: 'category.priority,priority' }),
      comboService.findAll(
        { isActive: true, endDate: { $gte: now } },
        { populate: 'items.selectableProducts.product', sortBy: 'priority' }
      ),
      dealSettingService.findOne({}),
    ]);

    const promoIdsToVerify = rawPromotions.filter((p) => p.maxQuantityPerCustomer > 0).map((p) => p.id.toString());

    let userPromoUsageMap = new Map();
    if (user && promoIdsToVerify.length > 0) {
      userPromoUsageMap = await orderService.getUserPromotionUsageMap(user, profile, promoIdsToVerify);
    }

    const productPromoMap = new Map();
    const comboPromoMap = new Map();
    for (const promo of rawPromotions) {
      if (this.isPromoValidGlobally(promo, startOfDay)) {
        const pId = this.getItemId(promo.product);
        const cId = this.getItemId(promo.combo);
        if (pId) productPromoMap.set(pId, promo);
        if (cId) comboPromoMap.set(cId, promo);
      }
    }

    // Helper tạo object promotion cho item
    const getPromotionData = (promo) => {
      if (!promo) return null;
      const pIdStr = promo._id ? promo._id.toString() : promo.id.toString();
      const userUsedCount = userPromoUsageMap.get(pIdStr) || 0;
      const isLimitReachedForUser = promo.maxQuantityPerCustomer > 0 && userUsedCount >= promo.maxQuantityPerCustomer;

      return {
        ...promo.toObject(),
        id: pIdStr,
        userUsedCount,
        isLimitReachedForUser,
        requiresLogin: !user && promo.maxQuantityPerCustomer > 0,
      };
    };

    const categoryMap = new Map();
    const flashSaleItems = [];

    // XỬ LÝ PRODUCTS
    for (const product of products) {
      if (!product.category || !product.category.isActive) continue;
      const pObj = product.toObject();
      const productIdStr = pObj.id.toString();
      const promo = productPromoMap.get(productIdStr);

      const baseItem = {
        ...pObj,
        image: pObj.image ? `${IMAGE_PREFIX}${pObj.image}` : '',
      };

      // 1. Nếu có promo, tạo một bản sao cho mục Flash Sale
      if (promo) {
        flashSaleItems.push({
          ...baseItem,
          promotion: getPromotionData(promo),
          type: 'Product',
        });
      }

      // 2. Cho mục Thực đơn (thucDon), luôn để promotion là null theo yêu cầu
      const catId = this.getItemId(product.category);
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: product.category.name,
          description: product.category.description,
          showInMenu: product.category.showInMenu,
          priority: product.category.priority || 0,
          products: [],
        });
      }
      categoryMap.get(catId).products.push({
        ...baseItem,
        promotion: null, // KHÔNG apply promo ở mục thực đơn
      });
    }

    // XỬ LÝ COMBOS (Thường combo luôn hiển thị giá khuyến mãi nếu có, hoặc bạn có thể làm tương tự như product)
    const processedCombos = combos.map((combo) => {
      const cObj = combo.toObject();
      const promo = comboPromoMap.get(cObj.id.toString());
      const processed = {
        ...cObj,
        image: cObj.image ? `${IMAGE_PREFIX}${cObj.image}` : '',
        basePrice: cObj.comboPrice,
        promotion: getPromotionData(promo),
      };

      // Nếu combo có promo, đưa vào Flash Sale (nếu muốn flash sale chứa cả combo)
      if (processed.promotion) {
        flashSaleItems.push({ ...processed, type: 'Combo' });
      }
      return processed;
    });

    const responseData = {
      flashSaleCategory:
        flashSaleItems.length > 0
          ? {
              id: 'flashsale',
              name: 'Flash Sale',
              description: (dealSetting && dealSetting.flashSale && dealSetting.flashSale.note) || '',
              showInMenu: dealSetting && dealSetting.flashSale && dealSetting.flashSale.value,
              priority: -999,
              products: flashSaleItems,
            }
          : null,
      thucDon: Array.from(categoryMap.values()).sort((a, b) => a.priority - b.priority),
      combos: processedCombos,
      descriptionCombo: (dealSetting && dealSetting.combo && dealSetting.combo.value && dealSetting.combo.note) || '',
    };

    if (!user) publicMenuCache = { data: responseData, timestamp: now.getTime() };
    res.status(OK).json(responseData);
  }
}

module.exports = new MenuController();
