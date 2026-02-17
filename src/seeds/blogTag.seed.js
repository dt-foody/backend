/* eslint-disable no-console, no-await-in-loop */
/**
 * Seed file: seeds/blogTag.seed.js
 * Mục đích: Khởi tạo dữ liệu cho Blog Tags từ các bài viết mẫu.
 * - Sử dụng phương pháp "Find and Save" để đảm bảo hooks được kích hoạt.
 */
const mongoose = require('mongoose');
const BlogTag = require('../models/blogTag.model');
const User = require('../models/user.model');
const config = require('../config/config');

// Dữ liệu mẫu để trích xuất tags
const posts = [
  { tags: ['Foody', 'Review quán ăn', 'DeliveryNow'] },
  { tags: ['Cà phê', 'Foody', 'Review quán'] },
  { tags: ['Foody', 'Google Maps', 'Ẩm thực Việt'] },
  { tags: ['Foody', 'Review quán ăn', 'Tips viết bài'] },
  { tags: ['Foody', 'Top món ăn', 'Review cộng đồng'] },
  { tags: ['Foody', 'Cộng đồng', 'Ẩm thực Việt'] },
  { tags: ['Foody', 'AI', 'Trải nghiệm ẩm thực'] },
  { tags: ['Foody', 'Now.vn', 'Giao đồ ăn'] },
  { tags: ['Foody', 'Ẩm thực Việt', 'Quốc tế'] },
  { tags: ['Foody', 'Startup Việt', 'Ẩm thực'] },
];

async function seedBlogTags() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('✅ MongoDB connected.');

    const superadmin = await User.findOne({ email: 'superadmin@gmail.com' }).select('_id').lean();
    if (!superadmin) {
      console.error('❌ Superadmin user not found. Aborting seed.');
      await mongoose.disconnect();
      return;
    }
    console.log(`👤 Found user: superadmin`);

    // Dùng Set để tự động loại bỏ các tag trùng lặp
    const tagNames = new Set();
    posts.forEach((post) => {
      post.tags.forEach((tagName) => tagNames.add(tagName.trim()));
    });

    console.log(`🌱 Found ${tagNames.size} unique tags to seed...`);

    for (const name of Array.from(tagNames)) {
      // 1. Tìm xem tag đã tồn tại chưa
      let tag = await BlogTag.findOne({ name });

      if (tag) {
        // 2a. Nếu đã tồn tại, cập nhật nếu cần
        tag.createdBy = superadmin._id;
        console.log(`   Found existing tag: ${name}. Ensuring data is correct.`);
      } else {
        // 2b. Nếu chưa tồn tại, tạo một document mới
        tag = new BlogTag({
          name,
          createdBy: superadmin._id,
          isActive: true,
        });
        console.log(`   Creating new tag: ${name}`);
      }

      // 3. Lệnh .save() sẽ kích hoạt tất cả các hooks (validate, save)
      await tag.save();
      console.log(`     -> Saved successfully (slug generated).`);
    }

    console.log('🎉 Blog Tag seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error while seeding Blog Tags:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected.');
  }
}

seedBlogTags();
