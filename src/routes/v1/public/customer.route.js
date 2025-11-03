const express = require('express');
const validate = require('../../../middlewares/validate.js');
const customerValidation = require('../../../validations/customer.validation.js');
const customerController = require('../../../controllers/customer.controller.js');
const queryMiddleware = require('../../../middlewares/queryMiddleware.js');
const auth = require('../../../middlewares/auth.js');

const router = express.Router();

router.patch('/', validate(customerValidation.updateProfile), auth(), customerController.updateProfile);

module.exports = router;
