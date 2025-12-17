const BaseRoute = require('../../utils/_base.route');
const { surchargeController } = require('../../controllers/index');
const { surchargeValidation } = require('../../validations/index');

// Middleware xử lý query params trước khi vào controller
function list(req, res, next) {
  const { search } = req.query;

  if (search) {
    if (!req.query.$or) {
      req.query.$or = [];
    }
    // Tìm kiếm theo tên hoặc mô tả
    req.query.$or.push({ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } });
    delete req.query.search;
  }

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

class SurchargeRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    // Resource name là 'surcharge' -> Sẽ tự động map quyền: surcharge.create, surcharge.read, ...
    super(surchargeController, surchargeValidation, 'surcharge', middlewares);
  }
}

module.exports = new SurchargeRoute().getRouter();
