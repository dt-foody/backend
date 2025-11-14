const express = require('express');
const menuController = require('../../../controllers/menu.controller.js');

const router = express.Router();

router.get('/', menuController.getMenu);

module.exports = router;
