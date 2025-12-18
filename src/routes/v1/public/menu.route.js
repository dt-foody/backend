const express = require('express');
const menuController = require('../../../controllers/menu.controller');
const { authOptional } = require('../../../middlewares/auth');

const router = express.Router();

router.get('/', authOptional(), menuController.getMenu);

module.exports = router;
