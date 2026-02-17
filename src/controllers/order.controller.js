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
    const { user, profile, profileType } = req; // Destructure items from req.body
    const data = { ...req.body };

    // Chuẩn bị contextData để tính điều kiện (Vd: Freehsip cho đơn > 500k, Khách hàng VIP...)
    const contextData = {
      // 1. User Info
      user,
      profile,
      // 2. Order Info
      order: data,
    };

    data.profileType = profileType || null;
    data.profile = profile ? profile._id || profile.id : null;
    data.createdBy = user ? user._id || user.id : null;

    const result = await this.service.customerOrder(data, user, contextData); // Pass contextData to service
    return res.status(OK).json(result);
  }

  async adminPanelCreateOrder(req, res) {
    const data = { ...req.body };

    data.createdBy = req.user._id || req.user.id;

    const result = await this.service.adminPanelCreateOrder(data, req.user);
    return res.status(OK).json(result);
  }

  async adminPanelUpdateOrder(req, res) {
    const { id } = req.params;
    const data = { ...req.body };

    const result = await this.service.adminPanelUpdateOrder(id, data, req.user);
    return res.status(OK).json(result);
  }

  async getByCode(req, res) {
    const { code } = req.params;
    const data = await this.service.findOne({ orderCode: code });
    return res.status(OK).json(data);
  }

  async getShippingFee(req, res) {
    const { lat, lng, orderTime, items, totalAmount } = req.body;

    const { user, profile } = req;

    const contextData = {
      user,
      profile,
      order: {
        totalAmount,
        items,
        createdAt: new Date(),
      },
    };

    const result = await this.service.calculateShippingFee(
      {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      },
      orderTime,
      contextData
    );

    return res.status(OK).json(result);
  }
}

module.exports = new OrderController();
