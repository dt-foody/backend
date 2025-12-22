const express = require('express');
const validate = require('../../../middlewares/validate');
const { blogPostValidation } = require('../../../validations');
const { blogPostController } = require('../../../controllers');
const { blogCategoryService } = require('../../../services');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

async function paginate(req, res, next) {
  const { categorySlug } = req.query;

  if (categorySlug) {
    const category = await blogCategoryService.findOne({ slug: categorySlug });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    req.query.categories = category._id;
  }

  delete req.query.categorySlug;

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
