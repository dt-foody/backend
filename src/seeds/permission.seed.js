/**
 * Seed file: seeds/permission.seed.js
 * Mục đích: Khởi tạo danh sách quyền (permissions) chuẩn cho hệ thống
 * - Không xóa dữ liệu cũ
 * - Tự động thêm hoặc cập nhật nếu có thay đổi
 */

const mongoose = require('mongoose');
const Permission = require('../models/permission.model');
const config = require('../config/config');

// Danh sách resource & action bạn muốn quản lý
const PERMISSIONS = {
  category: ['create', 'update', 'delete', 'read'],
  product: ['create', 'update', 'delete', 'read'],
  combo: ['create', 'update', 'delete', 'read'],
  order: ['create', 'update', 'delete', 'read'],
  user: ['create', 'update', 'delete', 'read'],
  role: ['create', 'update', 'delete', 'read'],
  customer: ['create', 'update', 'delete', 'read'],
  coupon: ['create', 'update', 'delete', 'read'],
  pricePromotion: ['create', 'update', 'delete', 'read'],
  blogPost: ['create', 'update', 'delete', 'read'],
  blogCategory: ['create', 'update', 'delete', 'read'],
  blogTag: ['create', 'update', 'delete', 'read'],
  pos: ['create', 'update', 'delete', 'read'],
};

// Hàm tạo danh sách permissions theo resource/action
function generatePermissions() {
  const result = [];
  for (const [resource, actions] of Object.entries(PERMISSIONS)) {
    for (const action of actions) {
      result.push({
        resource,
        action,
        name: `${resource}.${action}`,
        description: `Cho phép ${action} ${resource}`,
      });
    }
  }
  return result;
}

async function seedPermissions() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);

    const permissions = generatePermissions();
    console.log(`📋 Total permissions: ${permissions.length}`);

    for (const p of permissions) {
      await Permission.updateOne({ name: p.name }, { $set: p }, { upsert: true });
      console.log(`✅ Upserted: ${p.name}`);
    }

    console.log('🎉 Permission seeding completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error while seeding permissions:', error);
    process.exit(1);
  }
}

seedPermissions();
