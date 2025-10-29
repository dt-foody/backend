const BaseService = require('../utils/_base.service.js');
const { BlogPost } = require('../models/index.js');

class BlogPostService extends BaseService {
  constructor() {
    super(BlogPost);
  }
}

module.exports = new BlogPostService();