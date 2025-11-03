const BaseRoute = require('../../utils/_base.route');
const { voucherController } = require('../../controllers/index');
const { voucherValidation } = require('../../validations/index');

function list(req, res, next) {
  const { search } = req.query;
  if (search) {
    req.query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
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

class VoucherRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(voucherController, voucherValidation, 'voucher', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new VoucherRoute().getRouter();
