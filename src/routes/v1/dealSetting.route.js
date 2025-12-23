const BaseRoute = require('../../utils/_base.route');
const { dealSettingController } = require('../../controllers/index');
const { dealSettingValidation } = require('../../validations/index');

function list(req, res, next) {
  const { search } = req.query;

  if (search) {
    if (!req.query.$or) {
      req.query.$or = [];
    }
    req.query.$or.push({ title: { $regex: search, $options: 'i' } });
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

class DealSettingRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(dealSettingController, dealSettingValidation, 'dealSetting', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new DealSettingRoute().getRouter();
