/* eslint-disable no-console, no-await-in-loop */
/**
 * Seed file: seeds/category.seed.js
 * Mục đích: Khởi tạo danh mục (category) chuẩn theo dạng cây cho hệ thống Foody
 * - Không xóa dữ liệu cũ
 * - Tự động thêm hoặc cập nhật nếu có thay đổi
 */

const mongoose = require('mongoose');
const Category = require('../models/category.model');
const User = require('../models/user.model');
const config = require('../config/config');

// ============ DỮ LIỆU GỐC ============ //
const CATEGORY_DATA = [
  {
    name: 'Món Việt',
    description: 'Các món ăn truyền thống Việt Nam, đậm đà hương vị quê nhà',
    image: '/public/images/category/mon-viet.png',
    priority: 100,
    children: [
      { name: 'Cơm tấm', image: '/public/images/category/com-tam.png' },
      { name: 'Phở', image: '/public/images/category/pho.png' },
      { name: 'Bún chả', image: '/public/images/category/bun-cha.png' },
    ],
  },
  {
    name: 'Đồ ăn nhanh',
    description: 'Burger, pizza, gà rán, khoai tây chiên và nhiều món khác',
    image: '/public/images/category/fastfood.png',
    priority: 90,
    children: [
      { name: 'Burger', image: '/public/images/category/burger.png' },
      { name: 'Pizza', image: '/public/images/category/pizza.png' },
      { name: 'Gà rán', image: '/public/images/category/chicken.png' },
    ],
  },
  {
    name: 'Thức uống',
    description: 'Cà phê, trà sữa, nước ép, sinh tố tươi ngon mỗi ngày',
    image: '/public/images/category/drink.png',
    priority: 80,
    children: [
      { name: 'Trà sữa', image: '/public/images/category/trasua.png' },
      { name: 'Cà phê', image: '/public/images/category/coffee.png' },
      { name: 'Nước ép', image: '/public/images/category/nuocep.png' },
    ],
  },
  {
    name: 'Ăn vặt',
    description: 'Bánh tráng trộn, cá viên chiên, trà đào cam sả, snack...',
    image: '/public/images/category/anvat.png',
    priority: 70,
    children: [
      { name: 'Bánh tráng trộn', image: '/public/images/category/banhtrangtron.png' },
      { name: 'Cá viên chiên', image: '/public/images/category/cavienchien.png' },
      { name: 'Trà đào cam sả', image: '/public/images/category/tradao.png' },
    ],
  },
  {
    name: 'Món ngoại',
    description: 'Ẩm thực Hàn, Nhật, Thái và phương Tây',
    image: '/public/images/category/monngoai.png',
    priority: 60,
    children: [
      { name: 'Món Hàn', image: '/public/images/category/monhan.png' },
      { name: 'Món Nhật', image: '/public/images/category/monnhat.png' },
      { name: 'Món Thái', image: '/public/images/category/monthai.png' },
    ],
  },
];

// ============ SEED LOGIC ============ //
async function upsertCategory(data, parentId = null, ancestors = [], createdBy) {
  const existing = await Category.findOne({ name: data.name, parent: parentId });

  let category;
  if (existing) {
    category = await Category.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          description: data.description || '',
          image: data.image || '',
          priority: data.priority || 0,
          isActive: true,
          isDeleted: false,
          parent: parentId,
          ancestors,
        },
      },
      { new: true }
    );
    console.log(`🟡 Updated: ${data.name}`);
  } else {
    category = await Category.create({
      name: data.name,
      description: data.description || '',
      image: data.image || '',
      priority: data.priority || 0,
      isActive: true,
      parent: parentId,
      ancestors,
      createdBy,
    });
    console.log(`🟢 Created: ${data.name}`);
  }

  // === Seed con nếu có ===
  if (Array.isArray(data.children) && data.children.length > 0) {
    for (const child of data.children) {
      await upsertCategory(child, category._id, [...ancestors, category._id], createdBy);
    }
  }

  return category;
}

async function seedCategories() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);

    // --- Lấy user tạo ---
    const superadmin = (await User.findOne({ email: 'superadmin@gmail.com' }).select('_id').lean()) || null;

    if (!superadmin) {
      console.warn('⚠️ Không tìm thấy user superadmin@gmail.com → dùng ObjectId tạm.');
      return;
    }

    // --- Bắt đầu seed ---
    console.log('🌳 Seeding categories...');
    for (const cat of CATEGORY_DATA) {
      await upsertCategory(cat, null, [], superadmin._id);
    }

    console.log('✅ Category seeding completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error while seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();
