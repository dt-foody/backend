const express = require('express');
const validate = require('../../../middlewares/validate');
const { surchargeValidation } = require('../../../validations');
const { surchargeController } = require('../../../controllers');

const queryMiddleware = require('../../../middlewares/queryMiddleware');

async function paginate(req, res, next) {
  req.query.isActive = true;
  next();
}

const router = express.Router();

router.get('/', validate(surchargeValidation.paginate), queryMiddleware, paginate, surchargeController.paginate);

module.exports = router;
