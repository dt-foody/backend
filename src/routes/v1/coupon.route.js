const BaseRoute = require('../../utils/_base.route.js'); // Import BaseRoute
const { couponController } = require('../../controllers/index.js');
const { couponValidation } = require('../../validations/index.js');

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

class CouponRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [ list ],
      create: [ create ],
      findById: [ findById ],
      updateById: [ updateById ],
      deleteById: [ deleteById ],
      deleteManyById: [ deleteManyById ],
    };
    super(couponController, couponValidation, 'coupon', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new CouponRoute().getRouter();