const httpStatus = require('http-status');
const he = require('he');
const BaseController = require('../utils/_base.controller');
const { blogPostService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class BlogPostController extends BaseController {
  constructor() {
    super(blogPostService);

    this.findBySlug = catchAsync(this.findBySlug.bind(this));
    this.groupByCategory = catchAsync(this.groupByCategory.bind(this));
  }

  async findBySlug(req, res) {
    const query = { slug: req.params.slug };

    const data = await this.service.findOne(query, req.options);

    if (data && data.content) {
      data.content = he.decode(data.content);
    }

    res.status(OK).json(data);
  }

  async groupByCategory(req, res) {
    const result = await this.service.groupByCategory(req.query, req.options);

    res.status(OK).json(result);
  }
}

module.exports = new BlogPostController();
