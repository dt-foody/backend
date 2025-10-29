const BaseController = require('../utils/_base.controller.js');
const { blogTagService } = require('../services/index.js');
const httpStatus = require('http-status');
const he = require('he');

const { OK } = httpStatus;

class BlogTagController extends BaseController {
  constructor() {
    super(blogTagService);
  }

  async findBySlug(req, res) {
    const query = { slug: req.params.slug };

    const data = await blogTagService.findOne(query, req.options);
    
    if (data && data.content) {
      data.content = he.decode(data.content);
    }

    res.status(OK).json(data);
  }
}

module.exports = new BlogTagController();