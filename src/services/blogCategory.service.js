const BaseService = require('../utils/_base.service');
const { BlogCategory } = require('../models');

class BlogCategoryService extends BaseService {
  constructor() {
    super(BlogCategory);
  }

  /**
   * Override hàm paginate để đếm số lượng bài viết
   * @param {Object} filter - Query filter từ Controller
   * @param {Object} options - Pagination options { page, limit, sortBy, ... }
   */
  async paginate(filter = {}, options = {}) {
    // 1. Xử lý điều kiện lọc (Match) giống như BaseService
    const match = { ...filter };

    // Tự động thêm điều kiện isDeleted nếu chưa có (theo logic cũ của bạn)
    if (this.model.schema.path('isDeleted') && match.isDeleted === undefined) {
      match.isDeleted = false;
    }
    // Tự động thêm isEnabled nếu có trong schema
    if (this.model.schema.path('isEnabled') && match.isEnabled === undefined) {
      match.isEnabled = true;
    }

    // Xử lý tìm kiếm regex cho tên (nếu có)
    if (match.name && typeof match.name === 'string') {
      match.name = { $regex: match.name, $options: 'i' };
    }

    // 2. Chuẩn bị thông số phân trang & sắp xếp
    const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
    const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 20;
    const skip = (page - 1) * limit;

    const sort = {};
    if (options.sortBy) {
      options.sortBy.split(',').forEach((orderBy) => {
        const [key, order] = orderBy.split(':');
        sort[key] = order === 'desc' ? -1 : 1;
      });
    } else {
      sort.createdAt = -1; // Mặc định sắp xếp mới nhất
    }

    // 3. Xây dựng Aggregation Pipeline
    const pipeline = [
      // Bước 1: Lọc danh sách Category
      { $match: match },

      // Bước 2: Lookup sang bảng blogposts để đếm
      {
        $lookup: {
          from: 'blogposts', // Tên collection trong DB (lưu ý: số nhiều, thường viết thường)
          let: { catId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$catId', '$categories'] }, // Logic tìm bài viết thuộc category này
                isDeleted: false, // Chỉ đếm bài chưa xóa
                status: 'published', // QUAN TRỌNG: Chỉ đếm bài đã xuất bản
              },
            },
            { $project: { _id: 1 } }, // Tối ưu: chỉ lấy ID
          ],
          as: 'posts',
        },
      },

      // Bước 3: Tính toán trường count và xóa mảng posts thừa
      {
        $addFields: {
          postCount: { $size: '$posts' },
        },
      },
      { $project: { posts: 0 } }, // Xóa mảng bài viết đi cho nhẹ

      // Bước 4: Sắp xếp
      { $sort: sort },

      // Bước 5: Phân trang bằng Facet (Lấy data và count cùng lúc)
      {
        $facet: {
          results: [
            { $skip: skip },
            { $limit: limit },
            {
              $addFields: {
                id: { $toString: '$_id' }, // 1. Tạo field id từ _id
              },
            },
            {
              $project: {
                _id: 0, // 2. Xóa field _id
                __v: 0, // 3. Xóa field __v
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    // 4. Thực thi
    const [result] = await this.model.aggregate(pipeline);

    // 5. Format dữ liệu trả về chuẩn theo cấu trúc của plugin paginate
    const { results } = result;
    const totalResults = result.totalCount[0] ? result.totalCount[0].count : 0;
    const totalPages = Math.ceil(totalResults / limit);

    return {
      results, // Danh sách category kèm field count
      page,
      limit,
      totalPages,
      totalResults,
    };
  }
}

module.exports = new BlogCategoryService();
