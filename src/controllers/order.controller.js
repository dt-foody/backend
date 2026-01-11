const httpStatus = require('http-status');
const BaseController = require('../utils/_base.controller');
const { orderService } = require('../services');
const catchAsync = require('../utils/catchAsync');

const { OK } = httpStatus;

class OrderController extends BaseController {
  constructor() {
    super(orderService);

    this.customerOrder = catchAsync(this.customerOrder.bind(this));
    this.adminPanelCreateOrder = catchAsync(this.adminPanelCreateOrder.bind(this));
    this.adminPanelUpdateOrder = catchAsync(this.adminPanelUpdateOrder.bind(this));
    this.getByCode = catchAsync(this.getByCode.bind(this));
    this.getShippingFee = catchAsync(this.getShippingFee.bind(this));
  }

  async customerOrder(req, res) {
    const data = { ...req.body };
    const { user, profile, profileType } = req;

    data.profileType = profileType || null;
    data.profile = profile ? profile._id || profile.id : null;
    data.createdBy = user ? user._id || user.id : null;

    const result = await this.service.customerOrder(data);
    return res.status(OK).json(result);
  }

  async adminPanelCreateOrder(req, res) {
    const data = { ...req.body };

    data.createdBy = req.user._id || req.user.id;

    const result = await this.service.adminPanelCreateOrder(data);
    return res.status(OK).json(result);
  }

  async adminPanelUpdateOrder(req, res) {
    const { id } = req.params;
    const data = { ...req.body };

    const result = await this.service.adminPanelUpdateOrder(id, data);
    return res.status(OK).json(result);
  }

  async getByCode(req, res) {
    const { code } = req.params;
    const data = await this.service.findOne({ orderCode: code });
    return res.status(OK).json(data);
  }

  async getShippingFee(req, res) {
    // Lấy lat, lng từ query string (trên URL)
    // Query params thường là string, nhưng Joi validation đã giúp parse thành number
    const { lat, lng, orderTime } = req.query;

    const result = await this.service.calculateShippingFee(
      {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      },
      orderTime
    );

    return res.status(OK).json(result);
  }
}

module.exports = new OrderController();
