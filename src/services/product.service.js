const mongoose = require('mongoose');
const BaseService = require('../utils/_base.service');
const { Product } = require('../models');

class ProductService extends BaseService {
  constructor() {
    super(Product);

    this.groupByCategory = this.groupByCategory.bind(this);
  }

  async groupByCategory(query) {
    const modifiedQuery = { ...query };

    // Áp dụng điều kiện mặc định
    if (this.model.schema.path('isDeleted') && modifiedQuery.isDeleted === undefined) {
      modifiedQuery.isDeleted = false;
    }
    if (this.model.schema.path('isEnabled') && modifiedQuery.isEnabled === undefined) {
      modifiedQuery.isEnabled = true;
    }
    if (this.model.schema.path('isActive') && modifiedQuery.isActive === undefined) {
      modifiedQuery.isActive = true;
    }

    if (modifiedQuery.category) {
      modifiedQuery.category = mongoose.Types.ObjectId(modifiedQuery.category);
    }

    const result = await this.model.aggregate([
      { $match: modifiedQuery },

      // Gộp nhóm theo category
      {
        $group: {
          _id: '$category',
          products: { $push: '$$ROOT' },
          totalProducts: { $sum: 1 },
        },
      },

      // Join sang collection categories để lấy thông tin chi tiết
      {
        $lookup: {
          from: 'categories', // tên collection categories trong MongoDB
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },

      // Lấy phần tử đầu tiên của mảng category
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Sắp xếp theo tên category
      {
        $sort: { 'category.name': 1 },
      },

      // Format lại dữ liệu trả về (tùy chọn)
      {
        $project: {
          _id: 0,
          category: {
            _id: '$category._id',
            name: '$category.name',
          },
          totalProducts: 1,
          products: 1,
        },
      },
    ]);

    const transformed = result.map((group) => ({
      ...group,
      products: group.products.map((p) => ({
        ...p,
        id: p._id,
        _id: undefined, // hoặc delete sau cũng được
      })),
    }));

    return transformed;
  }
}

module.exports = new ProductService();
