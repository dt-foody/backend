const express = require('express');
const validate = require('../../../middlewares/validate');
const dealSettingValidation = require('../../../validations/dealSetting.validation');
const dealSettingController = require('../../../controllers/dealSetting.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

function paginate(req, res, next) {
  next();
}

const router = express.Router();

router.get('/', validate(dealSettingValidation.paginate), queryMiddleware, paginate, dealSettingController.paginate);

module.exports = router;
