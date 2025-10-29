const BaseController = require('../utils/_base.controller.js');
const { blogCategoryService } = require('../services/index.js');
const httpStatus = require('http-status');
const he = require('he');

const { OK } = httpStatus;

class BlogCategoryController extends BaseController {
  constructor() {
    super(blogCategoryService);
  }

  async findBySlug(req, res) {
    const query = { slug: req.params.slug };

    const data = await blogCategoryService.findOne(query, req.options);
    
    if (data && data.content) {
      data.content = he.decode(data.content);
    }
    return res.status(OK).json(data);
  }
}

module.exports = new BlogCategoryController();