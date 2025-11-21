const express = require('express');
const validate = require('../../../middlewares/validate');
const customerValidation = require('../../../validations/customer.validation');
const customerController = require('../../../controllers/customer.controller');
const { auth } = require('../../../middlewares/auth');

const router = express.Router();

router.patch('/', validate(customerValidation.updateProfile), auth(), customerController.updateProfile);

module.exports = router;
