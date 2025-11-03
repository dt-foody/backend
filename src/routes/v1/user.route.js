const BaseRoute = require('../../utils/_base.route');
const { userController } = require('../../controllers/index');
const { userValidation } = require('../../validations/index');
const auth = require('../../middlewares/auth'); // Import auth middleware
const validate = require('../../middlewares/validate');

function list(req, res, next) {
  next();
}

function create(req, res, next) {
  next();
}

function findById(req, res, next) {
  next();
}

function updateById(req, res, next) {
  next();
}

function deleteById(req, res, next) {
  next();
}

function deleteManyById(req, res, next) {
  next();
}

class UserRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(userController, userValidation, 'user', middlewares);

    this.router.post(
      '/change-password',
      auth(),
      validate(userValidation.changePassword),
      this.controller.changePassword.bind(this.controller)
    );

    // Thêm route tùy chỉnh cho changePassword
    // this.addCustomRoutes();
  }
}

module.exports = new UserRoute().getRouter();
