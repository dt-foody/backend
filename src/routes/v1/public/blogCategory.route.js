const express = require('express');
const validate = require('../../../middlewares/validate.js');
const blogCategoryValidation = require('../../../validations/blogCategory.validation.js');
const blogCategoryController = require('../../../controllers/blogCategory.controller.js');
const queryMiddleware = require('../../../middlewares/queryMiddleware.js');

const router = express.Router();

console.log(blogCategoryController.findBySlug); // nếu undefined thì chính là nguyên nhân


router.get('/', validate(blogCategoryValidation.paginate), queryMiddleware, paginate, blogCategoryController.paginate);
router.get('/:slug', queryMiddleware, blogCategoryController.findBySlug);

module.exports = router;


function paginate(req, res, next) {
    next();
}
