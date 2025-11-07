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
  async groupByCategory(query = {}, options = {}) {
    const limit = query.limit || 2;

    const pipeline = [
      {
        $match: {
          isDeleted: false,
          status: 'published',
        },
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
          slug: '$_id.categorySlug',
          posts: { $slice: ['$posts', limit] },
        },
      },
      { $sort: { category: 1 } },
    ];

    const result = await BlogPost.aggregate(pipeline);

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
