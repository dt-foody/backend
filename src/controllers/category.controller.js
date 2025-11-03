const BaseController = require('../utils/_base.controller');
const { categoryService } = require('../services');

class CategoryController extends BaseController {
  constructor() {
    super(categoryService);
  }
}

module.exports = new CategoryController();
