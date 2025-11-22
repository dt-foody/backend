const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
// eslint-disable-next-line no-unused-vars
const { roleRights } = require('../config/roles');

// eslint-disable-next-line no-unused-vars
const verifyCallback = (req, resolve, reject, requiredRights) => async (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.user = user;
  // Logic check quyền (nếu cần uncomment sau này)
  // if (requiredRights.length) {
  //   const userRights = roleRights.get(user.role);
  //   const hasRequiredRights = requiredRights.every((requiredRight) => userRights.includes(requiredRight));
  //   if (!hasRequiredRights && req.params.userId !== user.id) {
  //     return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
  //   }
  // }
  resolve();
};

// --- THÊM MỚI: Callback cho trường hợp không bắt buộc ---
const verifyOptionalCallback = (req, resolve, reject) => async (err, user, info) => {
  // Nếu có lỗi hệ thống (err) thì báo lỗi
  if (err) {
    return reject(err);
  }
  // Nếu có user (token hợp lệ), gán vào req
  if (user) {
    req.user = user;
  }
  // Dù có user hay không (user == false hoặc info có lỗi token),
  // ta đều cho qua (resolve) để Controller xử lý tiếp
  resolve();
};

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

// --- THÊM MỚI: Hàm authOptional ---
const authOptional = () => async (req, res, next) => {
  return new Promise((resolve, reject) => {
    // Sử dụng verifyOptionalCallback thay vì verifyCallback thường
    passport.authenticate('jwt', { session: false }, verifyOptionalCallback(req, resolve, reject))(req, res, next);
  })
    .then(() => next())
    .catch((err) => next(err));
};

// Nhớ export thêm authOptional
module.exports = {
  auth,
  authOptional,
};
