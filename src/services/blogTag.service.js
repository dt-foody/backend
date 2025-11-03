const BaseService = require('../utils/_base.service');
const { BlogTag } = require('../models');

class BlogTagService extends BaseService {
  constructor() {
    super(BlogTag);
  }
}

module.exports = new BlogTagService();
