const BaseController = require('../utils/_base.controller.js');
const { productService } = require('../services/index.js');

class ProductController extends BaseController {
  constructor() {
    super(productService);
  }
}

module.exports = new ProductController();