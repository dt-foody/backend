// const { roleRights } = require('../config/roles');
const Role = require('../models/role.model');
const Permission = require('../models/permission.model');

async function getEffectivePermissions(user) {
  const permissions = new Set();

  // 1️⃣. Lấy quyền từ role hệ thống (VD: admin, manager)
  //   const systemPerms = roleRights.get(user.role) || [];
  //   systemPerms.forEach(p => permissions.add(p));

  // 2️⃣. Lấy quyền từ các role custom (populate roles → permissions)
  if (user.roles && user.roles.length) {
    const customRoles = await Role.find({ _id: { $in: user.roles } }).populate('permissions');
    customRoles.forEach((role) => {
      role.permissions.forEach((p) => permissions.add(p.name));
    });
  }

  // 3️⃣. Cộng thêm extraPermissions
  if (user.extraPermissions && user.extraPermissions.length) {
    const extras = await Permission.find({ _id: { $in: user.extraPermissions } });
    extras.forEach((p) => permissions.add(p.name));
  }

  // 4️⃣. Loại bỏ excludePermissions
  if (user.excludePermissions && user.excludePermissions.length) {
    const excludes = await Permission.find({ _id: { $in: user.excludePermissions } });
    excludes.forEach((p) => permissions.delete(p.name));
  }

  return Array.from(permissions);
}

module.exports = { getEffectivePermissions };
