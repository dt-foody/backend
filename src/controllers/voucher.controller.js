const BaseController = require('../utils/_base.controller');
const { voucherService } = require('../services');

class VoucherController extends BaseController {
  constructor() {
    super(voucherService);
  }
}

module.exports = new VoucherController();
