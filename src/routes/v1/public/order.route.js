const express = require('express');
const httpStatus = require('http-status');
const validate = require('../../../middlewares/validate');
const orderValidation = require('../../../validations/order.validation');
const orderController = require('../../../controllers/order.controller');
const { auth, authOptional } = require('../../../middlewares/auth');
const { attachProfile } = require('../../../middlewares/attachProfile');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

const { BAD_REQUEST } = httpStatus;

function customerOrder(req, res, next) {
  next();
}

function getByCode(req, res, next) {
  next();
}

function paginate(req, res, next) {
  const { profile } = req;

  if (!profile) {
    return res.status(BAD_REQUEST).send({
      statusCode: BAD_REQUEST,
      message: 'Profile not found',
    });
  }

  req.query.profile = profile._id || profile.id;

  next();
}

const router = express.Router();

router.get(
  '/',
  validate(orderValidation.paginate),
  auth(),
  attachProfile,
  queryMiddleware,
  paginate,
  orderController.paginate
);

router.get('/shipping-fee', validate(orderValidation.getShippingFee), orderController.getShippingFee);

router.get(
  '/:code/by-code',
  validate(orderValidation.getByCode),
  auth(),
  queryMiddleware,
  getByCode,
  orderController.getByCode
);

router.post(
  '/',
  validate(orderValidation.customerOrder),
  authOptional(),
  attachProfile,
  customerOrder,
  orderController.customerOrder
);

router.post('/anonymous', validate(orderValidation.customerOrder), customerOrder, orderController.customerOrder);

module.exports = router;
