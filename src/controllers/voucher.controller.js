const BaseController = require('../utils/_base.controller.js');
const { voucherService } = require('../services/index.js');

class VoucherController extends BaseController {
  constructor() {
    super(voucherService);
  }
}

module.exports = new VoucherController();