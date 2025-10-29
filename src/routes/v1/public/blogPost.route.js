const express = require('express');
const validate = require('../../../middlewares/validate.js');
const blogPostValidation = require('../../../validations/blogPost.validation.js');
const blogPostController = require('../../../controllers/blogPost.controller.js');
const queryMiddleware = require('../../../middlewares/queryMiddleware.js');

const router = express.Router();

console.log(blogPostController.findBySlug); // nếu undefined thì chính là nguyên nhân


router.get('/', validate(blogPostValidation.paginate), queryMiddleware, paginate, blogPostController.paginate);
router.get('/:slug', queryMiddleware, blogPostController.findBySlug);

module.exports = router;


function paginate(req, res, next) {
    next();
}
