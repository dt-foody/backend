const BaseService = require('../utils/_base.service.js');
const { Voucher } = require('../models/index.js');

class VoucherService extends BaseService {
  constructor() {
    super(Voucher);
  }
}

module.exports = new VoucherService();
