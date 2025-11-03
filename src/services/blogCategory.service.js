const BaseService = require('../utils/_base.service');
const { BlogCategory } = require('../models');

class BlogCategoryService extends BaseService {
  constructor() {
    super(BlogCategory);
  }
}

module.exports = new BlogCategoryService();
