const BaseService = require('../utils/_base.service');
const { Category } = require('../models');

class CategoryService extends BaseService {
  constructor() {
    super(Category);
  }
}

module.exports = new CategoryService();
