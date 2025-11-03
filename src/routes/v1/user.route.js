const BaseRoute = require('../../utils/_base.route.js');
const { userController } = require('../../controllers/index.js');
const { userValidation } = require('../../validations/index.js');
const auth = require('../../middlewares/auth'); // Import auth middleware

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
    
    // Thêm route tùy chỉnh cho changePassword
    this.addCustomRoutes();
  }

  addCustomRoutes() {
    // POST /api/users/me/change-password
    this.router.post(
      '/me/change-password',
      auth(), // Middleware xác thực (đảm bảo user đã đăng nhập)
      // userValidation.changePassword, // Nếu có validation
      userController.changePassword.bind(userController)
    );
  }
}

module.exports = new UserRoute().getRouter();