const express = require('express');
const validate = require('../../../middlewares/validate');
const categoryValidation = require('../../../validations/category.validation');
const categoryController = require('../../../controllers/category.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

function paginate(req, res, next) {
  const { level } = req.query;

  if (level === 1) {
    req.query.parent = null;
  }

  req.query.isActive = true;

  delete req.query.level;
  next();
}

const router = express.Router();

router.get('/', validate(categoryValidation.paginate), queryMiddleware, paginate, categoryController.paginate);

module.exports = router;
