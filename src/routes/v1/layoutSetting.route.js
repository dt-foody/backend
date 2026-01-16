const BaseRoute = require('../../utils/_base.route');
const { layoutSettingController } = require('../../controllers');
const { layoutSettingValidation } = require('../../validations');

class LayoutSettingRoute extends BaseRoute {
  constructor() {
    super(layoutSettingController, layoutSettingValidation);
  }
}

module.exports = new LayoutSettingRoute().router;
