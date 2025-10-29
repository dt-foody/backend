/**
 * Seed file: seeds/product.seed.js
 * Mục đích: Khởi tạo dữ liệu sản phẩm (product) theo danh mục cho hệ thống Foody
 * - Không xóa dữ liệu cũ
 * - Tự động thêm hoặc cập nhật nếu có thay đổi
 */

const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Category = require('../models/category.model');
const User = require('../models/user.model');
const config = require('../config/config');

// ============ DỮ LIỆU GỐC ============ //
const PRODUCT_DATA = [
  {
    categoryName: 'Món Việt',
    items: [
      {
        name: 'Phở Bò Hà Nội',
        description: 'Phở bò truyền thống với nước dùng trong, thơm và đậm đà.',
        basePrice: 45000,
        thumbnailUrl: '/public/images/products/pho.png',
        priority: 100,
        optionGroups: [
          {
            name: 'Kích cỡ',
            options: [
              { name: 'Nhỏ', priceModifier: 0 },
              { name: 'Lớn', priceModifier: 10000 },
            ],
          },
          {
            name: 'Topping thêm',
            options: [
              { name: 'Thịt bò tái', priceModifier: 15000 },
              { name: 'Bò viên', priceModifier: 10000 },
              { name: 'Trứng chần', priceModifier: 5000 },
            ],
          },
        ],
      },
      {
        name: 'Cơm Tấm Sườn Bì Chả',
        description: 'Cơm tấm Sài Gòn trứ danh với sườn nướng thơm ngon.',
        basePrice: 50000,
        thumbnailUrl: '/public/images/products/com-tam.png',
        priority: 90,
      },
      {
        name: 'Bún Chả Hà Nội',
        description: 'Bún chả thịt nướng với nước mắm chua ngọt đặc trưng.',
        basePrice: 55000,
        thumbnailUrl: '/public/images/products/bun-cha.png',
        priority: 85,
      },
    ],
  },
  {
    categoryName: 'Đồ ăn nhanh',
    items: [
      {
        name: 'Burger Bò Phô Mai',
        description: 'Burger bò nướng, phô mai tan chảy và rau tươi.',
        basePrice: 65000,
        thumbnailUrl: '/public/images/products/burger.png',
        optionGroups: [
          {
            name: 'Size',
            options: [
              { name: 'Nhỏ', priceModifier: 0 },
              { name: 'Vừa', priceModifier: 10000 },
              { name: 'Lớn', priceModifier: 20000 },
            ],
          },
        ],
      },
      {
        name: 'Pizza Hải Sản',
        description: 'Pizza hải sản tươi ngon với phô mai mozzarella.',
        basePrice: 120000,
        thumbnailUrl: '/public/images/products/pizza.png',
        priority: 80,
      },
      {
        name: 'Gà Rán Giòn Cay',
        description: 'Gà rán giòn rụm với sốt cay đặc trưng.',
        basePrice: 60000,
        thumbnailUrl: '/public/images/products/chicken.png',
        priority: 70,
      },
    ],
  },
  {
    categoryName: 'Thức uống',
    items: [
      {
        name: 'Cà Phê Sữa Đá',
        description: 'Cà phê phin Việt Nam, vị đậm đà và ngọt béo.',
        basePrice: 30000,
        thumbnailUrl: '/public/images/products/coffee.png',
      },
      {
        name: 'Trà Sữa Trân Châu',
        description: 'Trà sữa truyền thống với trân châu đen dai ngon.',
        basePrice: 40000,
        thumbnailUrl: '/public/images/products/trasua.png',
        optionGroups: [
          {
            name: 'Topping',
            options: [
              { name: 'Trân châu đen', priceModifier: 5000 },
              { name: 'Pudding trứng', priceModifier: 7000 },
              { name: 'Thạch trái cây', priceModifier: 7000 },
            ],
          },
        ],
      },
      {
        name: 'Nước Ép Cam Tươi',
        description: 'Nước ép cam nguyên chất 100%, không thêm đường.',
        basePrice: 35000,
        thumbnailUrl: '/public/images/products/nuocep.png',
      },
    ],
  },
  {
    categoryName: 'Ăn vặt',
    items: [
      {
        name: 'Bánh Tráng Trộn',
        description: 'Bánh tráng trộn Sài Gòn với khô bò, trứng cút và rau răm.',
        basePrice: 25000,
        thumbnailUrl: '/public/images/products/banhtrangtron.png',
      },
      {
        name: 'Cá Viên Chiên',
        description: 'Cá viên chiên nóng giòn, chấm tương ớt cay nồng.',
        basePrice: 20000,
        thumbnailUrl: '/public/images/products/cavienchien.png',
      },
      {
        name: 'Trà Đào Cam Sả',
        description: 'Thức uống mát lạnh, vị đào thơm và sả tươi.',
        basePrice: 40000,
        thumbnailUrl: '/public/images/products/tradao.png',
      },
    ],
  },
  {
    categoryName: 'Món ngoại',
    items: [
      {
        name: 'Mì Cay Hàn Quốc',
        description: 'Mì cay cấp độ theo ý muốn, topping đa dạng.',
        basePrice: 70000,
        thumbnailUrl: '/public/images/products/my-cay.png',
      },
      {
        name: 'Sushi Cá Hồi',
        description: 'Sushi cá hồi tươi, phục vụ kèm wasabi và gừng muối.',
        basePrice: 90000,
        thumbnailUrl: '/public/images/products/sushi.png',
      },
      {
        name: 'Mì Ý Sốt Bò Bằm',
        description: 'Mì Ý sốt bò bằm đậm đà, phô mai parmesan thơm béo.',
        basePrice: 85000,
        thumbnailUrl: '/public/images/products/my-y.png',
      },
    ],
  },
];

// ============ SEED LOGIC ============ //
async function upsertProduct(productData, categoryId, createdBy) {
  const existing = await Product.findOne({
    name: productData.name,
    category: categoryId,
  });

  if (existing) {
    await Product.findByIdAndUpdate(existing._id, {
      $set: {
        description: productData.description || '',
        basePrice: productData.basePrice || 0,
        thumbnailUrl: productData.thumbnailUrl || '',
        priority: productData.priority || 0,
        optionGroups: productData.optionGroups || [],
        isActive: true,
        isDeleted: false,
      },
    });
    console.log(`🟡 Updated: ${productData.name}`);
  } else {
    await Product.create({
      ...productData,
      category: categoryId,
      createdBy,
    });
    console.log(`🟢 Created: ${productData.name}`);
  }
}

async function seedProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);

    const superadmin =
      (await User.findOne({ email: 'superadmin@gmail.com' }).select('_id').lean()) || null;
    if (!superadmin) {
      console.warn('⚠️ Không tìm thấy user superadmin@gmail.com → dùng ObjectId tạm.');
      return;
    }

    console.log('🍔 Seeding products...');
    for (const group of PRODUCT_DATA) {
      const category = await Category.findOne({ name: group.categoryName, parent: null });
      if (!category) {
        console.warn(`⚠️ Bỏ qua, không tìm thấy category "${group.categoryName}"`);
        continue;
      }

      for (const item of group.items) {
        await upsertProduct(item, category._id, superadmin._id);
      }
    }

    console.log('✅ Product seeding completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error while seeding products:', error);
    process.exit(1);
  }
}

seedProducts();
