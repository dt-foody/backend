const express = require('express');
const validate = require('../../../middlewares/validate');
const blogPostValidation = require('../../../validations/blogPost.validation');
const blogPostController = require('../../../controllers/blogPost.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

function paginate(req, res, next) {
  next();
}

const router = express.Router();
router.get('/', validate(blogPostValidation.paginate), queryMiddleware, paginate, blogPostController.paginate);
router.get(
  '/group-by-category',
  validate(blogPostValidation.paginate),
  queryMiddleware,
  paginate,
  blogPostController.groupByCategory
);
router.get('/:slug', queryMiddleware, blogPostController.findBySlug);

module.exports = router;
