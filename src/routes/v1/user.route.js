const BaseRoute = require('../../utils/_base.route.js'); // Import BaseRoute
const { userController } = require('../../controllers/index.js');
const { userValidation } = require('../../validations/index.js');

function list(req, res, next) {
  next();
};

function create(req, res, next) {
  next();
};

function findById(req, res, next) {
  next();
};

function updateById(req, res, next) {
  next();
};

function deleteById(req, res, next) {
  next();
};

function deleteManyById(req, res, next) {
  next();
};

class UserRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [ list ],
      create: [ create ],
      findById: [ findById ],
      updateById: [ updateById ],
      deleteById: [ deleteById ],
      deleteManyById: [ deleteManyById ],
    };
    super(userController, userValidation, 'user', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new UserRoute().getRouter();