const BaseController = require('../utils/_base.controller');
const { productService } = require('../services');

class ProductController extends BaseController {
  constructor() {
    super(productService);
  }
}

module.exports = new ProductController();
