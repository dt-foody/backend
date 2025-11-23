const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { employeeService } = require('../services');

const catchAsync = require('../utils/catchAsync');

const { CREATED, OK } = httpStatus;

class EmployeeController extends BaseController {
  constructor() {
    super(employeeService);
    this.create = catchAsync(this.create.bind(this));
    this.updateById = catchAsync(this.updateById.bind(this));
  }

  /**
   * Overwrite hàm create mặc định
   * @param {Object} req
   * @param {Object} res
   */
  async create(req, res) {
    const { user: userData, ...employeeData } = req.body;

    employeeData.createdBy = req.user.id;

    if (userData) {
      userData.createdBy = req.user.id;
    }

    const result = await this.service.create(employeeData, userData);

    // 3. Trả về kết quả
    res.status(CREATED).json(result);
  }

  /**
   * Overwrite hàm updateById mặc định
   * @param {Object} req
   * @param {Object} res
   */
  async updateById(req, res) {
    const { user: userData, ...employeeData } = req.body;
    const { id } = req.params;

    // create new
    if (userData && !userData.id) {
      userData.createdBy = req.user.id;
    }

    const result = await this.service.updateById(id, employeeData, userData);

    // 3. Trả về kết quả
    res.status(OK).json(result);
  }
}

module.exports = new EmployeeController();
