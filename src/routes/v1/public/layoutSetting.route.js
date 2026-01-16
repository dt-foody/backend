const express = require('express');
const { layoutSettingController } = require('../../../controllers');
const { layoutSettingValidation } = require('../../../validations');
const validate = require('../../../middlewares/validate');

const router = express.Router();

router.route('/').get(validate(layoutSettingValidation.getLayoutSettings), layoutSettingController.paginate);

module.exports = router;
