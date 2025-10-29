const BaseRoute = require('../../utils/_base.route.js'); // Import BaseRoute
const { comboController } = require('../../controllers/index.js');
const { comboValidation } = require('../../validations/index.js');

function list(req, res, next) {
  const { search } = req.query;
  if (search) {
    if (!req.query.$or) {
      req.query.$or = [];
    }
    req.query.$or.push(
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    );
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

class ComboRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [ list ],
      create: [ create ],
      findById: [ findById ],
      updateById: [ updateById ],
      deleteById: [ deleteById ],
      deleteManyById: [ deleteManyById ],
    };
    super(comboController, comboValidation, 'combo', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new ComboRoute().getRouter();