const httpStatus = require('http-status');
const BaseRoute = require('../../utils/_base.route');
const { voucherController } = require('../../controllers/index');
const { voucherValidation } = require('../../validations/index');
const { Coupon, Voucher } = require('../../models'); // Import Model để query
const ApiError = require('../../utils/ApiError');

// Middleware xử lý filter list
function list(req, res, next) {
  const { search } = req.query;
  if (search) {
    req.query.$or = [
      { code: { $regex: search, $options: 'i' } },
      // Có thể search theo tên customer/employee nếu populate,
      // nhưng ở level query filter này thường chỉ search field trực tiếp.
    ];
    delete req.query.search;
  }
  next();
}

// Middleware xử lý logic tạo Voucher (Snapshot & Auto Code)
async function create(req, res, next) {
  try {
    const { coupon: couponId } = req.body;
    let { code } = req.body; // Dùng let để gán lại nếu tự sinh

    // 1. Tìm Coupon gốc để lấy rule
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return next(new ApiError(httpStatus.NOT_FOUND, 'Chương trình khuyến mãi (Coupon) không tồn tại'));
    }

    // 2. Tạo Snapshot từ Coupon
    req.body.discountSnapshot = {
      type: coupon.valueType,
      value: coupon.value,
      maxDiscount: coupon.maxDiscountAmount,
      minOrderAmount: coupon.minOrderAmount,
    };

    // 3. Xử lý Code (Chia 2 trường hợp)

    // === TRƯỜNG HỢP A: User tự nhập code ===
    if (code) {
      const isTaken = await Voucher.findOne({ code });
      if (isTaken) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Mã voucher này đã tồn tại, vui lòng chọn mã khác'));
      }
    }

    // === TRƯỜNG HỢP B: Backend tự sinh code (Có retry nếu trùng) ===
    else {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10; // Giới hạn số lần thử để tránh vòng lặp vô tận (an toàn)

      while (!isUnique && attempts < maxAttempts) {
        // Sinh code ngẫu nhiên
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const generatedCode = `${coupon.code}-${randomSuffix}`;

        // Kiểm tra nhanh trong DB (dùng .exists() hoặc .countDocuments() nhanh hơn .findOne())
        // eslint-disable-next-line no-await-in-loop
        const exists = await Voucher.exists({ code: generatedCode });

        if (!exists) {
          code = generatedCode;
          isUnique = true;
        }
        attempts += 1;
      }

      if (!isUnique) {
        // Trường hợp cực hiếm khi quay 10 lần vẫn trùng
        return next(
          new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Hệ thống đang bận, không thể sinh mã voucher. Vui lòng thử lại.')
        );
      }

      // Gán code đã sinh thành công vào body
      req.body.code = code;
    }

    next();
  } catch (error) {
    next(error);
  }
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

class VoucherRoute extends BaseRoute {
  constructor() {
    const middlewares = {
      list: [list],
      create: [create], // Đã gắn middleware xử lý logic
      findById: [findById],
      updateById: [updateById],
      deleteById: [deleteById],
      deleteManyById: [deleteManyById],
    };
    super(voucherController, voucherValidation, 'voucher', middlewares);
  }
}

module.exports = new VoucherRoute().getRouter();
