const { Router } = require('express');
const { menuController } = require('../../controllers/index');

const router = Router();

router.get('/', menuController.getMenu.bind(menuController));

module.exports = router;

