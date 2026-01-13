const httpStatus = require('http-status');
const he = require('he');
const catchAsync = require('./catchAsync');

class BaseController {
  constructor(service) {
    this.service = service;
    this.modelHasSoftDelete = 'isDeleted' in this.service.model.schema.paths; // 🔥 Kiểm tra model có `isDeleted`
    this.create = catchAsync(this.create.bind(this));
    this.paginate = catchAsync(this.paginate.bind(this));
    this.findById = catchAsync(this.findById.bind(this));
    this.updateById = catchAsync(this.updateById.bind(this));
    this.deleteById = catchAsync(this.deleteById.bind(this));
    this.deleteManyById = catchAsync(this.deleteManyById.bind(this));
  }

  async create(req, res) {
    req.body.createdBy = req.user.id;

    const data = await this.service.create(req.body);
    res.status(httpStatus.CREATED).json(data);
  }

  async paginate(req, res) {
    if (req.query.$or && !req.query.$or.length) {
      delete req.query.$or; // Xóa $or nếu không có điều kiện nào
    }
    if (req.query.$and && !req.query.$and.length) {
      delete req.query.$and; // Xóa $and nếu không có điều kiện nào
    }

    delete req.query.search;

    console.log("query", req.query);

    const data = await this.service.paginate(req.query, req.options);

    res.status(httpStatus.OK).json(data);
  }

  async findById(req, res) {
    const query = { _id: req.params.id };
    const data = await this.service.findOne(query, req.options);

    if (data && data.content) {
      data.content = he.decode(data.content);
    }

    res.status(httpStatus.OK).json(data);
  }

  async updateById(req, res) {
    const query = { _id: req.params.id };
    const data = await this.service.updateOne(query, req.body);
    res.status(httpStatus.OK).json(data);
  }

  async deleteById(req, res) {
    const query = { _id: req.params.id };
    if (this.modelHasSoftDelete) {
      await this.service.deleteSoftOne(query, req.user.id);
    } else {
      await this.service.deleteHardOne(query);
    }

    res.status(httpStatus.OK).json({ success: true });
  }

  async deleteManyById(req, res) {
    const query = {
      _id: {
        $in: req.params.ids.split(',').map((id) => id.trim()),
      },
    };
    if (this.modelHasSoftDelete) {
      await this.service.deleteSoftMany(query, req.user.id);
    } else {
      await this.service.deleteHardMany(query);
    }

    res.status(httpStatus.OK).json({ success: true });
  }
}

module.exports = BaseController;
