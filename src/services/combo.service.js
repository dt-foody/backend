const BaseService = require('../utils/_base.service.js');
const { Combo } = require('../models/index.js');

class ComboService extends BaseService {
  constructor() {
    super(Combo);
  }
}

module.exports = new ComboService();