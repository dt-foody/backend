const express = require('express');
const validate = require('../../../middlewares/validate');
const pricePromotionValidation = require('../../../validations/pricePromotion.validation');
const pricePromotionController = require('../../../controllers/pricePromotion.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

const router = express.Router();

router.get('/', validate(pricePromotionValidation.paginate), queryMiddleware, pricePromotionController.paginate);

module.exports = router;
