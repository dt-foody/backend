const express = require('express');
const menuController = require('../../../controllers/menu.controller');
const { authOptional } = require('../../../middlewares/auth');
const { attachProfile } = require('../../../middlewares/attachProfile');

const router = express.Router();

router.get('/', authOptional(), attachProfile, menuController.getMenu);

module.exports = router;
