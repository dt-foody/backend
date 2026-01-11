const httpStatus = require('http-status');
const BaseService = require('../utils/_base.service');
const { Employee, User } = require('../models');

const ApiError = require('../utils/ApiError');

const { BAD_REQUEST, NOT_FOUND } = httpStatus;

class EmployeeService extends BaseService {
  constructor() {
    super(Employee);

    this.create = this.create.bind(this);
    this.updateById = this.updateById.bind(this);
  }

  async create(employeeData, userData) {
    let userId = null;
    if (userData) {
      const isEmailTaken = await User.isEmailTaken(userData.email);
      if (isEmailTaken) {
        throw new ApiError(BAD_REQUEST, 'Email đã được sử dụng');
      }

      // Tạo User
      const user = await User.create(userData); // Trả về mảng do dùng transaction
      userId = user._id;
    }

    if (userId) {
      // eslint-disable-next-line no-param-reassign
      employeeData.user = userId;
    }

    const employeeRecord = await this.model.create(employeeData);

    return this.model.findById(employeeRecord._id).populate('user');
  }

  async updateById(id, employeeData, userData) {
    // 1. Lấy employee hiện tại
    const employee = await this.model.findById(id);
    if (!employee) {
      throw new ApiError(NOT_FOUND, 'Nhân viên không tồn tại');
    }

    // 2. Xử lý User (Account)
    if (userData) {
      // TRƯỜNG HỢP A: Đã có User liên kết -> Update User đó
      if (employee.user) {
        // Check trùng email (trừ chính user này ra)
        if (userData.email) {
          const isEmailTaken = await User.isEmailTaken(userData.email, employee.user);
          if (isEmailTaken) {
            throw new ApiError(BAD_REQUEST, 'Email đã được sử dụng');
          }
        }
        await User.findByIdAndUpdate(employee.user, userData);
      }
      // TRƯỜNG HỢP B: Chưa có User -> Tạo mới User và Link vào
      else {
        // Check trùng email (không cần trừ ai cả vì là tạo mới)
        const isEmailTaken = await User.isEmailTaken(userData.email);
        if (isEmailTaken) {
          throw new ApiError(BAD_REQUEST, 'Email đã được sử dụng');
        }

        // Tạo User mới
        const newUserPayload = {
          ...userData,
        };

        const newUser = await User.create(newUserPayload);

        // Gán ID user mới tạo vào data update của employee
        // eslint-disable-next-line no-param-reassign
        employeeData.user = newUser._id;
      }
    }

    // 3. Cập nhật thông tin Employee
    Object.assign(employee, employeeData);
    await employee.save();

    // 4. Trả về kết quả
    return employee.populate('user');
  }
}

module.exports = new EmployeeService();
