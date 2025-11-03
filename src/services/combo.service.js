const BaseService = require('../utils/_base.service');
const { Combo } = require('../models');

class ComboService extends BaseService {
  constructor() {
    super(Combo);
  }
}

module.exports = new ComboService();
