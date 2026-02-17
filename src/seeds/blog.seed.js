/* eslint-disable no-console, no-await-in-loop */
/**
 * Seed file: seeds/blog.seed.js
 * Mục đích: Khởi tạo dữ liệu mẫu cho blog (Foody review, ẩm thực, trải nghiệm)
 * - Không xóa dữ liệu cũ
 * - Upsert (cập nhật nếu tồn tại)
 */

const mongoose = require('mongoose');
const he = require('he');
const BlogPost = require('../models/blogPost.model');
const User = require('../models/user.model');
const config = require('../config/config');

const posts = [
  {
    title: 'Trải Nghiệm Foody – Hành Trình Từ Ứng Dụng Review Đến “Người Bạn Ăn Uống” Của Giới Trẻ',
    slug: 'trai-nghiem-foody',
    summary: 'Foody – từ một trang web nhỏ chia sẻ địa điểm ăn uống đến nền tảng ẩm thực lớn nhất Việt Nam.',
    content: he.encode(`
      <p><strong>Foody</strong> đã trở thành cái tên quen thuộc với hầu hết người Việt yêu thích ẩm thực. 
      Mình vẫn nhớ những ngày đầu, khi muốn tìm quán ăn ngon, thường phải hỏi bạn bè hoặc lướt Facebook. 
      Nhưng từ khi biết đến Foody, việc tìm địa điểm ăn uống trở nên dễ dàng hơn bao giờ hết.</p>
      <p>Điều mình thích nhất ở Foody là <em>sự chân thực trong từng đánh giá</em>. 
      Không phải những bài PR bóng bẩy, mà là chia sẻ thật của người dùng: món nào ngon, món nào dở, quán phục vụ ra sao.</p>
      <p>Ngày nay, Foody không chỉ dừng ở việc giới thiệu quán ăn. 
      Nó đã trở thành “người bạn” luôn đồng hành trên hành trình ẩm thực của nhiều người.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Foody Review Image',
    categories: ['Ẩm thực', 'Trải nghiệm'],
    tags: ['Foody', 'Review quán ăn', 'DeliveryNow'],
    status: 'published',
    publishedAt: new Date('2024-05-12'),
    isFeatured: true,
    seoTitle: 'Foody – Hành Trình Ẩm Thực Việt',
    seoDescription: 'Foody, nền tảng giúp người Việt khám phá và chia sẻ ẩm thực một cách chân thực.',
  },
  {
    title: 'Top 5 Quán Cà Phê Chill Nhất Trên Foody',
    slug: 'top-5-quan-ca-phe-foody',
    summary: 'Danh sách 5 quán cà phê được cộng đồng Foody bình chọn nhiều nhất năm 2024.',
    content: he.encode(`
      <p>Cà phê không chỉ là đồ uống – đó là không gian để thư giãn và trò chuyện. 
      Dưới đây là 5 quán cà phê được Foody cộng đồng bình chọn là “đáng đi nhất”.</p>
      <ul>
        <li>The Coffee House – không gian thân thiện, hương vị ổn định.</li>
        <li>Oromia Coffee – góc sống ảo tuyệt đẹp, đồ uống sáng tạo.</li>
        <li>RuNam Bistro – sang trọng, phù hợp gặp đối tác.</li>
      </ul>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Top coffee on Foody',
    categories: ['Cà phê', 'Địa điểm'],
    tags: ['Cà phê', 'Foody', 'Review quán'],
    status: 'published',
    publishedAt: new Date('2024-06-01'),
    isFeatured: true,
    seoTitle: 'Top 5 Quán Cà Phê Chill Trên Foody',
    seoDescription: 'Khám phá 5 quán cà phê được yêu thích nhất trên Foody năm 2024.',
  },
  {
    title: 'Foody Có Gì Hay Hơn Google Maps?',
    slug: 'foody-vs-google-maps',
    summary: 'So sánh hai nền tảng lớn trong việc tìm kiếm địa điểm ăn uống.',
    content: he.encode(`
      <p>Nếu bạn muốn tìm quán ăn nhanh, Google Maps có thể giúp. 
      Nhưng nếu bạn muốn <strong>biết món nào ngon thật sự</strong>, Foody mới là lựa chọn đúng.</p>
      <p>Điểm mạnh của Foody là cộng đồng review chân thực, hình ảnh món ăn, và bảng giá cụ thể. 
      Còn Google Maps thì tiện cho chỉ đường, nhưng thông tin ẩm thực lại khá sơ sài.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Foody vs Google Maps',
    categories: ['So sánh', 'Công nghệ ẩm thực'],
    tags: ['Foody', 'Google Maps', 'Ẩm thực Việt'],
    status: 'published',
    publishedAt: new Date('2024-06-15'),
    seoTitle: 'Foody vs Google Maps – Ai Dẫn Đầu Trong Cuộc Đua Ẩm Thực?',
    seoDescription: 'Bài so sánh thực tế giữa Foody và Google Maps trong hành trình khám phá ẩm thực.',
  },
  {
    title: 'Mẹo Viết Review Quán Ăn Hấp Dẫn Trên Foody',
    slug: 'meo-viet-review-foody',
    summary: 'Chia sẻ cách viết bài review thu hút lượt xem và tương tác trên Foody.',
    content: he.encode(`
      <p>Muốn review được chú ý? Hãy bắt đầu bằng tiêu đề hấp dẫn, hình ảnh thật và đánh giá trung thực. 
      Đừng ngại nêu nhược điểm – đó chính là thứ khiến bài viết của bạn đáng tin cậy.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Tips viết review Foody',
    categories: ['Cộng đồng', 'Kinh nghiệm'],
    tags: ['Foody', 'Review quán ăn', 'Tips viết bài'],
    status: 'published',
    publishedAt: new Date('2024-07-05'),
    seoTitle: 'Mẹo Viết Review Foody Thu Hút',
    seoDescription: 'Hướng dẫn cách viết review quán ăn hấp dẫn và đáng tin trên Foody.',
  },
  {
    title: 'Top 10 Món Ăn Được Yêu Thích Nhất Trên Foody 2024',
    slug: 'top-10-mon-an-foody-2024',
    summary: 'Danh sách những món ăn hot nhất được người dùng Foody bình chọn trong năm qua.',
    content: he.encode(`
      <p>Từ phở bò, bún đậu mắm tôm, đến bánh tráng trộn – Foody đã tổng hợp danh sách top 10 món ăn được check-in nhiều nhất năm 2024.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Top foods on Foody',
    categories: ['Ẩm thực', 'Bình chọn'],
    tags: ['Foody', 'Top món ăn', 'Review cộng đồng'],
    status: 'published',
    publishedAt: new Date('2024-07-15'),
    seoTitle: 'Top 10 Món Ăn Hot Nhất Trên Foody 2024',
    seoDescription: 'Danh sách món ăn được yêu thích và review nhiều nhất trên Foody năm 2024.',
  },
  {
    title: 'Foody Và Hành Trình Xây Dựng Cộng Đồng Ẩm Thực Việt',
    slug: 'hanh-trinh-foody-cong-dong-am-thuc',
    summary: 'Câu chuyện về cách Foody gắn kết hàng triệu người yêu ẩm thực lại với nhau.',
    content: he.encode(`
      <p>Không chỉ là ứng dụng tìm quán ăn, Foody đã trở thành nơi kết nối giữa người nấu, người ăn và người yêu ẩm thực.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Foody Community',
    categories: ['Cộng đồng', 'Câu chuyện thương hiệu'],
    tags: ['Foody', 'Cộng đồng', 'Ẩm thực Việt'],
    status: 'published',
    publishedAt: new Date('2024-08-01'),
    seoTitle: 'Foody – Cộng Đồng Ẩm Thực Việt Nam',
    seoDescription: 'Hành trình xây dựng cộng đồng người yêu ẩm thực của Foody.',
  },
  {
    title: 'Khi Foody Gặp Công Nghệ – Trải Nghiệm Ẩm Thực 4.0',
    slug: 'foody-am-thuc-4-0',
    summary: 'Foody kết hợp AI và dữ liệu người dùng để gợi ý món ăn chuẩn gu.',
    content: he.encode(`
      <p>Nhờ ứng dụng công nghệ, Foody giúp người dùng chọn món ăn nhanh hơn, đúng khẩu vị hơn và tiết kiệm thời gian.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Foody Technology',
    categories: ['Công nghệ', 'Ẩm thực'],
    tags: ['Foody', 'AI', 'Trải nghiệm ẩm thực'],
    status: 'published',
    publishedAt: new Date('2024-08-15'),
    seoTitle: 'Foody Và Ẩm Thực 4.0',
    seoDescription: 'Cách Foody ứng dụng công nghệ AI để nâng cao trải nghiệm người dùng.',
  },
  {
    title: 'Review Now.vn – Người Hậu Duệ Của Foody Trong Kỷ Nguyên Giao Đồ Ăn',
    slug: 'review-now-vn-foody',
    summary: 'Trải nghiệm đặt món qua Now.vn – nền tảng giao đồ ăn nhanh thuộc Foody.',
    content: he.encode(`
      <p>Now.vn giúp việc đặt món trở nên nhanh chóng, tiện lợi và đồng bộ với hệ sinh thái Foody. Giao hàng đúng giờ, món ăn vẫn còn nóng hổi.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Now.vn Delivery',
    categories: ['Trải nghiệm', 'Công nghệ'],
    tags: ['Foody', 'Now.vn', 'Giao đồ ăn'],
    status: 'published',
    publishedAt: new Date('2024-09-10'),
    seoTitle: 'Review Now.vn – Dịch Vụ Giao Đồ Ăn Từ Foody',
    seoDescription: 'Đánh giá trải nghiệm sử dụng Now.vn – dịch vụ giao đồ ăn nhanh thuộc hệ sinh thái Foody.',
  },
  {
    title: 'Foody Góp Phần Đưa Ẩm Thực Việt Ra Thế Giới',
    slug: 'foody-am-thuc-viet-the-gioi',
    summary: 'Foody trở thành cầu nối giúp món Việt đến gần hơn với bạn bè quốc tế.',
    content: he.encode(`
      <p>Nhiều khách du lịch nước ngoài tìm quán Việt Nam nhờ Foody. 
      Đây là bước tiến lớn trong việc quảng bá ẩm thực Việt ra toàn cầu.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Ẩm thực Việt',
    categories: ['Ẩm thực', 'Văn hóa'],
    tags: ['Foody', 'Ẩm thực Việt', 'Quốc tế'],
    status: 'published',
    publishedAt: new Date('2024-09-25'),
    seoTitle: 'Foody Và Ẩm Thực Việt Trên Bản Đồ Thế Giới',
    seoDescription: 'Foody góp phần đưa món ăn Việt đến gần hơn với du khách quốc tế.',
  },
  {
    title: 'Làm Sao Để Foody Giữ Được Sức Hút Sau Hơn 10 Năm?',
    slug: 'foody-suc-hut-10-nam',
    summary: 'Phân tích lý do Foody vẫn giữ vị thế hàng đầu trong làng ẩm thực Việt.',
    content: he.encode(`
      <p>Foody giữ được sức hút nhờ liên tục đổi mới, chú trọng trải nghiệm người dùng và lắng nghe cộng đồng.</p>
    `),
    coverImage: 'http://localhost:3000/public/file-1760713229411-816646237.png',
    coverImageAlt: 'Foody 10 years',
    categories: ['Câu chuyện thương hiệu', 'Phân tích'],
    tags: ['Foody', 'Startup Việt', 'Ẩm thực'],
    status: 'published',
    publishedAt: new Date('2024-10-10'),
    seoTitle: 'Foody – Hành Trình 10 Năm Giữ Sức Hút',
    seoDescription: 'Phân tích hành trình phát triển và lý do Foody vẫn được yêu thích sau hơn 10 năm.',
  },
];

async function seedBlogs() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);

    const superadmin = (await User.findOne({ email: 'superadmin@gmail.com' }).select('_id').lean()) || null;
    if (!superadmin) {
      console.warn('⚠️ Không tìm thấy user superadmin@gmail.com → dùng ObjectId tạm.');
      return;
    }

    const i = 0;

    for (const post of posts) {
      post.createdBy = superadmin._id || superadmin.id;
      post.isDeleted = false;

      if (i % 2 === 0) {
        post.isPinned = true;
      } else {
        post.isPinned = false;
      }

      await BlogPost.updateOne({ slug: post.slug }, { $set: post }, { upsert: true, setDefaultsOnInsert: true });
      console.log(`✅ Upserted: ${post.title}`);
    }

    console.log('🎉 Blog seeding completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error while seeding blogs:', error);
    process.exit(1);
  }
}

seedBlogs();
