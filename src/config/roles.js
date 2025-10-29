const allRoles = {
  customer: [],
  staff: [],
  admin: ['getUsers', 'manageUsers'],
  manager: ['getUsers', 'manageUsers'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
