const BaseRoute = require('../../utils/_base.route');
const { layoutSettingController } = require('../../controllers');
const { layoutSettingValidation } = require('../../validations');

class LayoutSettingRoute extends BaseRoute {
  constructor() {
    const middlewares = {};
    super(layoutSettingController, layoutSettingValidation, 'layoutSettings', middlewares);
  }
}

module.exports = new LayoutSettingRoute().router;
