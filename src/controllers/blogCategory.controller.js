const httpStatus = require('http-status');
const he = require('he');
const BaseController = require('../utils/_base.controller');
const { blogCategoryService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class BlogCategoryController extends BaseController {
  constructor() {
    super(blogCategoryService);
    // ✅ chỉ thêm catchAsync, không đổi logic
    this.findBySlug = catchAsync(this.findBySlug.bind(this));
  }

  async findBySlug(req, res) {
    const query = { slug: req.params.slug };

    const data = await this.service.findOne(query, req.options);

    // Giữ nguyên logic giải mã content
    const plain = data && typeof data.toObject === 'function' ? data.toObject() : data;
    const result = plain && plain.content ? { ...plain, content: he.decode(plain.content) } : plain;

    return res.status(OK).json(result);
  }
}

module.exports = new BlogCategoryController();
