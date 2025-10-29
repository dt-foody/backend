const BaseService = require('../utils/_base.service.js');
const { BlogCategory } = require('../models/index.js');

class BlogCategoryService extends BaseService {
  constructor() {
    super(BlogCategory);
  }
}

module.exports = new BlogCategoryService();