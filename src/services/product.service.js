const BaseService = require('../utils/_base.service.js');
const { Product } = require('../models/index.js');

class ProductService extends BaseService {
  constructor() {
    super(Product);
  }
}

module.exports = new ProductService();