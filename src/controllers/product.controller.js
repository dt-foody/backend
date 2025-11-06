const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { productService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class ProductController extends BaseController {
  constructor() {
    super(productService);

    this.groupByCategory = catchAsync(this.groupByCategory.bind(this));
  }

  async groupByCategory(req, res) {
    const result = await this.service.groupByCategory(req.query, req.options);

    res.status(OK).json(result);
  }
}

module.exports = new ProductController();
