const express = require('express');
const validate = require('../../../middlewares/validate');
const blogCategoryValidation = require('../../../validations/blogCategory.validation');
const blogCategoryController = require('../../../controllers/blogCategory.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

function paginate(req, res, next) {
  next();
}

const router = express.Router();

router.get('/', validate(blogCategoryValidation.paginate), queryMiddleware, paginate, blogCategoryController.paginate);
router.get('/:slug', queryMiddleware, blogCategoryController.findBySlug);

module.exports = router;
