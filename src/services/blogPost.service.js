const BaseService = require('../utils/_base.service');
const { BlogPost } = require('../models');

class BlogPostService extends BaseService {
  constructor() {
    super(BlogPost);
  }
}

module.exports = new BlogPostService();
