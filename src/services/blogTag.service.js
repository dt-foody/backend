const BaseService = require('../utils/_base.service.js');
const { BlogTag } = require('../models/index.js');

class BlogTagService extends BaseService {
  constructor() {
    super(BlogTag);
  }
}

module.exports = new BlogTagService();