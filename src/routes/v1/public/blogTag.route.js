const express = require('express');
const validate = require('../../../middlewares/validate.js');
const blogTagValidation = require('../../../validations/blogTag.validation.js');
const blogTagController = require('../../../controllers/blogTag.controller.js');
const queryMiddleware = require('../../../middlewares/queryMiddleware.js');

const router = express.Router();

console.log(blogTagController.findBySlug); // nếu undefined thì chính là nguyên nhân


router.get('/', validate(blogTagValidation.paginate), queryMiddleware, paginate, blogTagController.paginate);
router.get('/:slug', queryMiddleware, blogTagController.findBySlug);

module.exports = router;


function paginate(req, res, next) {
    next();
}
