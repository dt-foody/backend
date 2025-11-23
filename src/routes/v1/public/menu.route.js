const express = require('express');
const menuController = require('../../../controllers/menu.controller');

const router = express.Router();

router.get('/', menuController.getMenu);

module.exports = router;
