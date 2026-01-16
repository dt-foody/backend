const BaseController = require('../utils/_base.controller');
const { auditLogService } = require('../services');

class AuditLogController extends BaseController {
  constructor() {
    super(auditLogService);
  }
}

module.exports = new AuditLogController();
