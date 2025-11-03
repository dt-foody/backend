const BaseRoute = require('../../utils/_base.route');
const { permissionController } = require('../../controllers/index');
const { permissionValidation } = require('../../validations/index');

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

class PermissionRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(permissionController, permissionValidation, 'permission', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new PermissionRoute().getRouter();
