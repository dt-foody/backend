const BaseRoute = require('../../utils/_base.route');
const { orderController } = require('../../controllers/index');
const { orderValidation } = require('../../validations/index');
const { auth } = require('../../middlewares/auth'); // Import auth middleware
const validate = require('../../middlewares/validate');

function list(req, res, next) {
  const { status, paymentStatus, shippingStatus, deliveryType, search, deliveryFrom, deliveryTo } = req.query;
  if (paymentStatus) {
    req.query['payment.status'] = paymentStatus;
    delete req.query.paymentStatus;
  }
  if (shippingStatus) {
    req.query['shipping.status'] = shippingStatus;
    delete req.query.shippingStatus;
  }

  if (deliveryType) {
    req.query['deliveryTime.option'] = deliveryType;
    delete req.query.deliveryType;
  }

  if (search) {
    req.query.orderId = Number.isNaN(Number(search)) ? -1 : Number(search);
    delete req.query.search;
  }
  if (status) {
    req.query.status = {
      $in: status.split(','),
    };
  }

  if (deliveryFrom && deliveryTo) {
    const from = new Date(deliveryFrom);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(deliveryTo);
    to.setUTCHours(23, 59, 59, 999);

    req.query.priorityTime = {
      $gte: from,
      $lte: to,
    };

    delete req.query.deliveryFrom;
    delete req.query.deliveryTo;
  }

  next();
}

function create(req, res, next) {
  next();
}

function findById(req, res, next) {
  req.options.populate = [
    {
      path: 'items.item',
    },
    {
      path: 'profile',
    },
  ];
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

    this.router.post(
      '/admin-order',
      auth(),
      validate(orderValidation.adminPanelCreateOrder),
      this.controller.adminPanelCreateOrder.bind(this.controller)
    );

    this.router.patch(
      '/admin-order/:id',
      auth(),
      validate(orderValidation.adminPanelUpdateOrder),
      this.controller.adminPanelUpdateOrder.bind(this.controller)
    );
  }
}

module.exports = new OrderRoute().getRouter();
