const { Router } = require('express');
const auth = require('../middlewares/auth.js');
const queryMiddleware = require('../middlewares/queryMiddleware.js');
const validate = require('../middlewares/validate.js');

// CRUD
class BaseRoute {
  constructor(controller, validation, resource, middlewares = {}, skips = {}) {
    this.router = Router();
    this.controller = controller;
    this.validation = validation;
    this.resource = resource;
    this.middlewares = middlewares;
    this.skips = skips;

    if (Array.isArray(this.middlewares.all) && this.middlewares.all.length) {
      this.router.use(...this.middlewares.all);
    }

    if (Array.isArray(this.middlewares.id) && this.middlewares.id.length) {
      this.router.all('/:id', ...this.middlewares.id); // Middleware kiểm tra quyền truy cập tổ chức
    }

    this.initializeRoutes();
  }

  registerRoute(method, path, permission, validationSchema, middlewares, handler) {
    this.router[method](
      path,
      auth(`${this.resource}.${permission}`), // phải đăng nhập mới xài được api
      validate(validationSchema), // ràng buộc dữ liệu
      ...(middlewares || []), // middlewares --> custom (tuỳ chỉnh)
      handler
    );
  }

  initializeRoutes() {
    if (!this.skips.create) {
      this.registerRoute('post', '', 'create', this.validation.create, this.middlewares.create, this.controller.create);
    }

    this.registerRoute(
      'get',
      '',
      'read',
      this.validation.paginate, // list
      [queryMiddleware, ...(this.middlewares.list || [])],
      this.controller.paginate
    );
    this.registerRoute(
      'get',
      '/:id',
      'read',
      this.validation.findById,
      [queryMiddleware, ...(this.middlewares.findById || [])],
      this.controller.findById
    );

    if (!this.skips.update) {
      this.registerRoute(
        'patch',
        '/:id',
        'update',
        this.validation.updateById,
        this.middlewares.updateById,
        this.controller.updateById
      );
    }

    this.registerRoute(
      'delete',
      '/:id',
      'delete',
      this.validation.deleteById,
      this.middlewares.deleteById,
      this.controller.deleteById
    );

    this.registerRoute(
      'delete',
      '/ids/:ids',
      'delete',
      this.validation.deleteManyById,
      this.middlewares.deleteManyById,
      this.controller.deleteManyById
    );
  }

  static auth(permission) {
    return auth(permission);
  }

  static validate(schema) {
    return validate(schema);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = BaseRoute;