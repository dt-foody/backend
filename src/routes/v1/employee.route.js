const BaseRoute = require('../../utils/_base.route');
const { employeeController } = require('../../controllers/index');
const { employeeValidation } = require('../../validations/index');

function list(req, res, next) {
  let { search } = req.query;

  if (search) {
    search = search.trim(); // Luôn trim khoảng trắng thừa

    // --- 1. ĐỊNH NGHĨA REGEX NHẬN DIỆN ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Phone: Cho phép số, dấu +, độ dài từ 9-15 ký tự (chấp nhận cả số chưa đủ dài nếu muốn tìm gần đúng)
    const phoneRegex = /^[0-9+]{8,15}$/;
    // Number: Chỉ gồm số (dùng để check ID)
    const isNumeric = !Number.isNaN(Number(search));

    const conditions = [];

    // --- 2. PHÂN LOẠI TÌM KIẾM ---

    if (emailRegex.test(search)) {
      // CASE A: Nếu giống Email -> Chỉ tìm trong emails.value
      // Dùng regex để tìm gần đúng hoặc exact match tùy bạn. Ở đây tìm gần đúng cho tiện.
      conditions.push({ 'emails.value': { $regex: search, $options: 'i' } });
    } else if (phoneRegex.test(search)) {
      // CASE B: Nếu giống Phone -> Ưu tiên tìm Phone
      conditions.push({ 'phones.value': { $regex: search, $options: 'i' } });

      // Nếu nó cũng là số, có thể người dùng đang gõ ID, nên tìm cả ID
      if (isNumeric) {
        conditions.push({ employeeId: Number(search) });
      }
    } else if (isNumeric) {
      // CASE C: Nếu chỉ là số (vd: 123) -> Tìm ID hoặc tìm Phone (những số đuôi điện thoại)
      conditions.push({ employeeId: Number(search) });
      conditions.push({ 'phones.value': { $regex: search, $options: 'i' } });
    } else {
      // CASE D: Còn lại (Chữ cái, tên) -> Tìm Name và Email (phần tên trước @)
      conditions.push({ name: { $regex: search, $options: 'i' } });
      conditions.push({ 'emails.value': { $regex: search, $options: 'i' } });
    }

    // --- 3. GỘP VÀO QUERY ---
    if (!req.query.$or) {
      req.query.$or = [];
    }

    // Nối các điều kiện tìm được vào mảng $or
    req.query.$or = req.query.$or.concat(conditions);

    delete req.query.search;
  }
  next();
}
function create(req, res, next) {
  next();
}

function findById(req, res, next) {
  next();
}

function updateById(req, res, next) {
  next();
}

function deleteById(req, res, next) {
  next();
}

function deleteManyById(req, res, next) {
  next();
}

class EmployeeRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create],
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(employeeController, employeeValidation, 'employee', middlewares); // Truyền controller, validation và resource
  }
}

module.exports = new EmployeeRoute().getRouter();
