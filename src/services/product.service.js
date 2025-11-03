const BaseService = require('../utils/_base.service');
const { Product } = require('../models');

class ProductService extends BaseService {
  constructor() {
    super(Product);
  }
}

module.exports = new ProductService();
