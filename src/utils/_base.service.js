const httpStatus = require('http-status');
const ApiError = require('./ApiError');

const { NOT_FOUND, NOT_MODIFIED } = httpStatus;

class BaseService {
  constructor(model) {
    this.model = model;
  }

  async countDocuments(query = {}) {
    return this.model.countDocuments(query);
  }

  async findAll(query = {}, options = { populate: '', select: '', lean: false, limit: 20 }) {
    // Tạo một bản sao của query để tránh sửa đổi tham số đầu vào
    const modifiedQuery = { ...query };

    // Kiểm tra nếu model có trường isDeleted và query chưa có isDeleted
    if (this.model.schema.path('isDeleted') && modifiedQuery.isDeleted === undefined) {
      modifiedQuery.isDeleted = false;
    }

    if (this.model.schema.path('isEnabled') && modifiedQuery.isEnabled === undefined) {
      modifiedQuery.isEnabled = true;
    }

    if (this.model.schema.path('isActive') && modifiedQuery.isActive === undefined) {
      modifiedQuery.isActive = true;
    }

    let dbQuery = this.model.find(modifiedQuery);

    if (options.select) dbQuery = dbQuery.select(options.select);

    if (options.populate) {
      dbQuery = dbQuery.populate(options.populate);
    }

    if (options.limit) {
      dbQuery = dbQuery.limit(options.limit);
    }

    if (options.lean) dbQuery = dbQuery.lean();

    return dbQuery;
  }

  async findOne(query = {}, options = { populate: '', select: '', lean: false }) {
    // Tạo một bản sao của query để tránh sửa đổi tham số đầu vào
    const modifiedQuery = { ...query };

    // Kiểm tra nếu model có trường isDeleted và query chưa có isDeleted
    if (this.model.schema.path('isDeleted') && modifiedQuery.isDeleted === undefined) {
      modifiedQuery.isDeleted = false;
    }

    let dbQuery = this.model.findOne(modifiedQuery);

    if (options.select) dbQuery = dbQuery.select(options.select);

    if (options.populate) {
      dbQuery = dbQuery.populate(options.populate);
    }

    if (options.lean) dbQuery = dbQuery.lean();

    return dbQuery;
  }

  async findById(id, options = { populate: '', select: '', lean: true }) {
    let dbQuery = this.model.findById(id);

    if (options.select) dbQuery = dbQuery.select(options.select);

    if (options.populate) {
      dbQuery = dbQuery.populate(options.populate);
    }

    if (options.lean) dbQuery = dbQuery.lean();

    return dbQuery;
  }

  async paginate(query = {}, options = { page: 1, limit: 20 }) {
    const modifiedQuery = { ...query };

    if (this.model.schema.path('isDeleted') && modifiedQuery.isDeleted === undefined) {
      modifiedQuery.isDeleted = false;
    }

    if (this.model.schema.path('isEnabled') && modifiedQuery.isEnabled === undefined) {
      modifiedQuery.isEnabled = true;
    }

    if (this.model.schema.path('isActive') && modifiedQuery.isActive === undefined) {
      modifiedQuery.isActive = true;
    }

    if (!this.model.paginate) {
      // Nếu không paginate thì gọi findAll để load theo cursor
      return this.findAll(query, options);
    }

    // Tạo bản sao để tránh thay đổi trực tiếp tham số
    const safeOptions = { ...options };

    safeOptions.page = Math.max(safeOptions.page || 1, 1);
    safeOptions.limit = Math.max(safeOptions.limit || 20, 1);

    return this.model.paginate(modifiedQuery, safeOptions);
  }

  async create(data) {
    return this.model.create(data);
  }

  async createMany(dataArray) {
    return this.model.insertMany(dataArray);
  }

  async updateById(id, data) {
    const result = await this.model.findByIdAndUpdate(id, data, { new: true });
    if (!result) throw new ApiError(NOT_FOUND, 'Data not found');

    return result;
  }

  async updateOne(query, data) {
    const result = await this.model.findOneAndUpdate(query, data, { new: true });
    if (!result) throw new ApiError(NOT_FOUND, 'No matching records found');

    return result;
  }

  async updateMany(query, data) {
    const result = await this.model.updateMany(query, data);
    if (!result) throw new ApiError(NOT_FOUND, 'No matching records found');

    return result;
  }

  async deleteHardById(id) {
    const result = await this.model.findByIdAndDelete(id);
    if (!result) throw new ApiError(NOT_FOUND, 'Data not found');

    return result;
  }

  async deleteSoftById(id, deletedBy) {
    const result = await this.model.updateOne({ _id: id }, { isDeleted: true, deletedAt: new Date(), deletedBy });
    if (result.matchedCount === 0) throw new ApiError(NOT_FOUND, 'Data not found');
    if (result.modifiedCount === 0) throw new ApiError(NOT_MODIFIED, 'Data was not modified');

    return result;
  }

  async deleteHardMany(query) {
    const result = await this.model.deleteMany(query);
    if (result.deletedCount === 0) throw new ApiError(NOT_FOUND, 'No records were deleted');

    return result;
  }

  async deleteSoftMany(query, deletedBy) {
    const result = await this.model.updateMany(query, { isDeleted: true, deletedAt: new Date(), deletedBy });
    if (result.matchedCount === 0) throw new ApiError(NOT_FOUND, 'No records found');
    if (result.modifiedCount === 0) throw new ApiError(NOT_MODIFIED, 'No records were marked as deleted');

    return result;
  }

  async deleteHardOne(query) {
    const result = await this.model.deleteOne(query);
    if (result.deletedCount === 0) throw new ApiError(NOT_FOUND, 'No records were deleted');

    return result;
  }

  async deleteSoftOne(query, deletedBy) {
    const result = await this.model.updateOne(query, { isDeleted: true, deletedAt: new Date(), deletedBy });
    if (result.matchedCount === 0) throw new ApiError(NOT_FOUND, 'No records found');
    if (result.modifiedCount === 0) throw new ApiError(NOT_MODIFIED, 'No records were marked as deleted');

    return result;
  }
}

module.exports = BaseService;
