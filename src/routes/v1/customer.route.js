const BaseRoute = require('../../utils/_base.route');
const { customerController } = require('../../controllers/index');
const { customerValidation } = require('../../validations/index');

function list(req, res, next) {
  const { search } = req.query;

  if (search) {
    if (!req.query.$or) {
      req.query.$or = [];
    }

    req.query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { customerId: Number.isNaN(search) ? -1 : Number(search) },
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

class CustomerRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(customerController, customerValidation, 'customer', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new CustomerRoute().getRouter();
