const BaseService = require('../utils/_base.service.js');
const { Category } = require('../models/index.js');

class CategoryService extends BaseService {
  constructor() {
    super(Category);
  }
}

module.exports = new CategoryService();
