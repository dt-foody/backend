const express = require('express');
const validate = require('../../../middlewares/validate');
const blogTagValidation = require('../../../validations/blogTag.validation');
const blogTagController = require('../../../controllers/blogTag.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware');

function paginate(req, res, next) {
  next();
}

const router = express.Router();
router.get('/', validate(blogTagValidation.paginate), queryMiddleware, paginate, blogTagController.paginate);
router.get('/:slug', queryMiddleware, blogTagController.findBySlug);

module.exports = router;
