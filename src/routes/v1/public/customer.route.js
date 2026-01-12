const express = require('express');
const validate = require('../../../middlewares/validate');
const customerValidation = require('../../../validations/customer.validation');
const customerController = require('../../../controllers/customer.controller');
const { auth } = require('../../../middlewares/auth');
const { attachProfile } = require('../../../middlewares/attachProfile');

const router = express.Router();

router.patch('/', validate(customerValidation.updateProfile), auth(), attachProfile, customerController.updateProfile);
router.get('/referral', auth(), attachProfile, customerController.getReferral);

module.exports = router;
