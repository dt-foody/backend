const express = require('express');
const validate = require('../../../middlewares/validate');
const userValidation = require('../../../validations/user.validation');
const userController = require('../../../controllers/user.controller');
const { auth } = require('../../../middlewares/auth');

const router = express.Router();

router.post(
  '/change-password',
  auth(),
  validate(userValidation.changePassword),
  userController.changePassword.bind(this.controller)
);

module.exports = router;
