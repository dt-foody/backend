const BaseService = require('../utils/_base.service');
const { BlogPost } = require('../models');

class BlogPostService extends BaseService {
  constructor() {
    super(BlogPost);
    this.groupByCategory = this.groupByCategory.bind(this);
  }

  /**
   * Gom bài viết theo category, tối ưu bằng aggregation
   * @param {Object} query
   * @returns {Promise<Array<{ category: string, slug: string, posts: [] }>>}
   */
  async groupByCategory(query = {}) {
    const limit = query.limit || 2;

    const conditions = {
      isDeleted: false,
      status: 'published',
    };

    if (query.displayPage) {
      conditions.displayPages = query.displayPage;
    }

    const pipeline = [
      {
        $match: conditions,
      },
      { $unwind: '$categories' },
      {
        $lookup: {
          from: 'blogcategories',
          localField: 'categories',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: {
            categoryId: '$category._id',
            categoryName: '$category.name',
            categorySlug: '$category.slug',
            priority: '$category.priority',
          },
          posts: {
            $push: {
              _id: '$_id',
              title: '$title',
              slug: '$slug',
              summary: '$summary',
              coverImage: '$coverImage',
              coverImageAlt: '$coverImageAlt',
              publishedAt: '$publishedAt',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id.categoryName',
          categoryId: '$_id.categoryId',
          priority: '$_id.priority',
          slug: '$_id.categorySlug',
          posts: { $slice: ['$posts', limit] },
        },
      },
      { $sort: { priority: 1, category: 1 } },
    ];

    const result = await this.model.aggregate(pipeline);

    const transformed = result.map((group) => ({
      ...group,
      posts: group.posts.map((p) => ({
        ...p,
        id: p._id,
        _id: undefined, // hoặc delete sau cũng được
      })),
    }));

    return transformed;
  }
}

module.exports = new BlogPostService();
