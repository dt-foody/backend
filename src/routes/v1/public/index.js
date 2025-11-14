const express = require('express');
// const docsRoute = require('./docs.route');
const config = require('../../../config/config');
const categoryRoute = require('./category.route');
const productRoute = require('./product.route');
const comboRoute = require('./combo.route');
const couponRoute = require('./coupon.route');
const pricePromotionRoute = require('./pricePromotion.route');
const blogPostRoute = require('./blogPost.route');
const blogTagRoute = require('./blogTag.route');
const blogCategoryRoute = require('./blogCategory.route');
const authRoute = require('../auth.route');
const customerRoute = require('./customer.route');
const orderRoute = require('./order.route');
const payosWebhook = require('./payos.webhook');
const menuRoute = require('./menu.route');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/categories',
    route: categoryRoute,
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
    path: '/coupons',
    route: couponRoute,
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
    path: '/customers',
    route: customerRoute,
  },
  {
    path: '/orders',
    route: orderRoute,
  },
  {
    path: '/payos-webhook',
    route: payosWebhook,
  },
  {
    path: '/menu',
    route: menuRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  // {
  //   path: '/docs',
  //   route: docsRoute,
  // },
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
