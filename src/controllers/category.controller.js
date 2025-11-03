const BaseController = require('../utils/_base.controller.js');
const { categoryService } = require('../services/index.js');

class CategoryController extends BaseController {
  constructor() {
    super(categoryService);
  }
}

module.exports = new CategoryController();
