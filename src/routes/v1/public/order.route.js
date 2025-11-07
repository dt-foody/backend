const express = require('express');
const validate = require('../../../middlewares/validate');
const orderValidation = require('../../../validations/order.validation');
const orderController = require('../../../controllers/order.controller');
const auth = require('../../../middlewares/auth');
const httpStatus = require('http-status');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

const { BAD_REQUEST } = httpStatus;

function customerOrder(req, res, next) {
  next();
}

function getByCode(req, res, next) {
  next();
}

function paginate(req, res, next) {
  const { user } = req;

  if (!user.profile) {
    return res.status(BAD_REQUEST).send({
      statusCode: BAD_REQUEST,
      message: 'Profile not found'
    })
  }

  req.query.profile = user.profile._id || user.profile.id || user.profile;

  next();
}

const router = express.Router();

router.get('/', validate(orderValidation.paginate), auth(), queryMiddleware, paginate, orderController.paginate);
router.get('/:code/by-code', validate(orderValidation.getByCode), auth(), queryMiddleware, getByCode, orderController.getByCode);
router.post('/', validate(orderValidation.customerOrder), auth(), customerOrder, orderController.customerOrder);

module.exports = router;

