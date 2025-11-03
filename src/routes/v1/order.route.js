const BaseRoute = require('../../utils/_base.route');
const { orderController } = require('../../controllers/index');
const { orderValidation } = require('../../validations/index');

function list(req, res, next) {
  const { paymentStatus, shippingStatus, search } = req.query;
  if (paymentStatus) {
    req.query['payment.status'] = paymentStatus;
    delete req.query.paymentStatus;
  }
  if (shippingStatus) {
    req.query['shipping.status'] = shippingStatus;
    delete req.query.shippingStatus;
  }
  if (search) {
    req.query.orderId = Number.isNaN(Number(search)) ? -1 : Number(search);
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

class OrderRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(orderController, orderValidation, 'order', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new OrderRoute().getRouter();
