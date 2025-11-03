/**
 * Seed file: seeds/permission.seed.js
 * Mục đích: Khởi tạo danh sách quyền (permissions) chuẩn cho hệ thống
 * - Không xóa dữ liệu cũ
 * - Tự động thêm hoặc cập nhật nếu có thay đổi
 */

const mongoose = require('mongoose');
const Permission = require('../models/permission.model');
const User = require('../models/user.model');
const config = require('../config/config');

async function seedPermissions() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);

    const permissions = await Permission.find({}).lean();
    const permissionsId = permissions.map((el) => el.id || el._id);

    await User.updateMany({ role: 'admin' }, { $set: { extraPermissions: permissionsId } });

    console.log('🎉 Permission seeding completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error while seeding permissions:', error);
    process.exit(1);
  }
}

seedPermissions();
