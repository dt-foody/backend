const express = require('express');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const docsRoute = require('./docs.route');
const config = require('../../config/config');
const categoryRoute = require('./category.route');
const productRoute = require('./product.route');
const comboRoute = require('./combo.route');
const fileRoute = require('./file.route');
const roleRoute = require('./role.route');
const permissionRoute = require('./permission.route');
const customerRoute = require('./customer.route');
const orderRoute = require('./order.route');
const couponRoute = require('./coupon.route');
const pricePromotionRoute = require('./pricePromotion.route');
const blogPostRoute = require('./blogPost.route');
const blogCategoryRoute = require('./blogCategory.route');
const blogTagRoute = require('./blogTag.route');
const voucherRoute = require('./voucher.route');
const employeeRoute = require('./employee.route');
const menuRoute = require('./menu.route');
const surchargeRoute = require('./surcharge.route');
const dealSettingRoute = require('./dealSetting.route');
const layoutSettingRoute = require('./layoutSetting.route');
const auditLogRoute = require('./auditLog.route');
const notificationRoute = require('./notification.route');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/categories',
    route: categoryRoute,
  },
  {
    path: '/files',
    route: fileRoute,
  },
  {
    path: '/products',
    route: productRoute,
  },
  {
    path: '/combos',
    route: comboRoute,
  },
  {
    path: '/employees',
    route: employeeRoute,
  },
  {
    path: '/roles',
    route: roleRoute,
  },
  {
    path: '/permissions',
    route: permissionRoute,
  },
  {
    path: '/customers',
    route: customerRoute,
  },
  {
    path: '/orders',
    route: orderRoute,
  },
  {
    path: '/coupons',
    route: couponRoute,
  },
  {
    path: '/vouchers',
    route: voucherRoute,
  },
  {
    path: '/price-promotions',
    route: pricePromotionRoute,
  },
  {
    path: '/blog-posts',
    route: blogPostRoute,
  },
  {
    path: '/blog-categories',
    route: blogCategoryRoute,
  },
  {
    path: '/blog-tags',
    route: blogTagRoute,
  },
  {
    path: '/menu',
    route: menuRoute,
  },
  {
    path: '/surcharges',
    route: surchargeRoute,
  },
  {
    path: '/deal-settings',
    route: dealSettingRoute,
  },
  {
    path: '/layout-settings',
    route: layoutSettingRoute,
  },
  {
    path: '/audit-logs',
    route: auditLogRoute,
  },
  {
    path: '/notifications',
    route: notificationRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
