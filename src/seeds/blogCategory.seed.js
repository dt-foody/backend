/**
 * Seed file: seeds/blogCategory.seed.js
 * Mục đích: Khởi tạo dữ liệu cho Blog Categories từ các bài viết mẫu.
 * - Sử dụng phương pháp "Find and Save" để đảm bảo hooks được kích hoạt.
 */
const mongoose = require('mongoose');
const BlogCategory = require('../models/blogCategory.model');
const User = require('../models/user.model');
const config = require('../config/config');

// Dữ liệu mẫu để trích xuất categories
const posts = [
  { categories: ["Ẩm thực", "Trải nghiệm"] },
  { categories: ["Cà phê", "Địa điểm"] },
  { categories: ["So sánh", "Công nghệ ẩm thực"] },
  { categories: ["Cộng đồng", "Kinh nghiệm"] },
  { categories: ["Ẩm thực", "Bình chọn"] },
  { categories: ["Cộng đồng", "Câu chuyện thương hiệu"] },
  { categories: ["Công nghệ", "Ẩm thực"] },
  { categories: ["Trải nghiệm", "Công nghệ"] },
  { categories: ["Ẩm thực", "Văn hóa"] },
  { categories: ["Câu chuyện thương hiệu", "Phân tích"] }
];

async function seedBlogCategories() {
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

    // Dùng Set để tự động loại bỏ các category trùng lặp
    const categoryNames = new Set();
    posts.forEach(post => {
      post.categories.forEach(catName => categoryNames.add(catName.trim()));
    });
    
    console.log(`🌱 Found ${categoryNames.size} unique categories to seed...`);

    for (const name of Array.from(categoryNames)) {
      // 1. Tìm xem category đã tồn tại chưa
      let category = await BlogCategory.findOne({ name: name });

      if (category) {
        // 2a. Nếu đã tồn tại, có thể cập nhật các trường nếu cần
        category.createdBy = superadmin._id; // Đảm bảo luôn có creator
        console.log(`   Found existing category: ${name}. Ensuring data is correct.`);
      } else {
        // 2b. Nếu chưa tồn tại, tạo một document mới
        category = new BlogCategory({
          name: name,
          createdBy: superadmin._id,
          isActive: true,
        });
        console.log(`   Creating new category: ${name}`);
      }

      // 3. Lệnh .save() sẽ kích hoạt tất cả các hooks (validate, save)
      // Nếu là document mới, nó sẽ insert. Nếu là document đã có, nó sẽ update.
      await category.save(); 
      console.log(`     -> Saved successfully (slug generated).`);
    }

    console.log('🎉 Blog Category seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error while seeding Blog Categories:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected.');
  }
}

seedBlogCategories();