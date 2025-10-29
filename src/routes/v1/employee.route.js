const BaseRoute = require('../../utils/_base.route.js'); // Import BaseRoute
const { employeeController } = require('../../controllers/index.js');
const { employeeValidation } = require('../../validations/index.js');

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
      { employeeId: isNaN(search) ? -1 : Number(search) },
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

class EmployeeRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [ list ],
      create: [ create ],
      findById: [ findById ],
      updateById: [ updateById ],
      deleteById: [ deleteById ],
      deleteManyById: [ deleteManyById ],
    };
    super(employeeController, employeeValidation, 'employee', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new EmployeeRoute().getRouter();