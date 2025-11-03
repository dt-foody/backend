const httpStatus = require('http-status');
const he = require('he');
const BaseController = require('../utils/_base.controller');
const { blogPostService } = require('../services');

const { OK } = httpStatus;

class BlogPostController extends BaseController {
  constructor() {
    super(blogPostService);
  }

  async findBySlug(req, res) {
    const query = { slug: req.params.slug };

    const data = await blogPostService.findOne(query, req.options);

    if (data && data.content) {
      data.content = he.decode(data.content);
    }

    res.status(OK).json(data);
  }
}

module.exports = new BlogPostController();
