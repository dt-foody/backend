const BaseRoute = require('../../utils/_base.route.js'); // Import BaseRoute
const { blogCategoryController } = require('../../controllers/index.js');
const { blogCategoryValidation } = require('../../validations/index.js');

function list(req, res, next) {
  const { search } = req.query;
  
  if (search) {
    if (!req.query.$or) {
      req.query.$or = [];
    }
    req.query.$or.push(
      { title: { $regex: search, $options: 'i' } },
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

class BlogCategoryRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [ list ],
      create: [ create ],
      findById: [ findById ],
      updateById: [ updateById ],
      deleteById: [ deleteById ],
      deleteManyById: [ deleteManyById ],
    };
    super(blogCategoryController, blogCategoryValidation, 'blogCategory', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new BlogCategoryRoute().getRouter();