const BaseService = require('../utils/_base.service');
const { Voucher } = require('../models/index');

class VoucherService extends BaseService {
  constructor() {
    super(Voucher);
  }
}

module.exports = new VoucherService();
