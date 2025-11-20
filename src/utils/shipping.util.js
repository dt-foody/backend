const moment = require('moment');

/**
 * Tính tiền ship dựa trên công thức giờ cao điểm/đêm/thường
 * @param {number} distanceKm Quãng đường (km)
 * @returns {number} Tiền ship (VND)
 */
const calculateShippingFeeByFormula = (distanceKm) => {
  const x = distanceKm;
  let shippingFee = 0;

  // Sử dụng utcOffset(7) để cố định múi giờ Việt Nam (UTC+7)
  const now = moment().utcOffset(7);

  const hour = now.hour();
  const dayOfWeek = now.day(); // 0: Sunday, 1: Monday, ..., 6: Saturday

  const isWeekend = dayOfWeek === 0; // Chủ nhật

  // Khung giờ cao điểm: (7h-9h); (17h-19h) Thứ 2-Thứ 7
  const isPeakHour = !isWeekend && ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19));

  // Khung giờ đêm (22h-6h) - Áp dụng cả tuần
  const isNightHour = hour >= 22 || hour < 6;

  if (isPeakHour) {
    // Công thức: 500*(x^2+5x+42)
    // Sửa Math.pow(x, 2) thành x ** 2
    shippingFee = 500 * (x ** 2 + 5 * x + 42);
  } else if (isNightHour) {
    // Công thức: 500*(x^2+x+44)
    shippingFee = 500 * (x ** 2 + x + 44);
  } else {
    // Khung giờ thường: 500*(x^2+x+24)
    shippingFee = 500 * (x ** 2 + x + 24);
  }

  // Làm tròn tiền ship (ví dụ làm tròn đến hàng trăm đồng)
  return Math.ceil(shippingFee / 100) * 100;
};

module.exports = {
  calculateShippingFeeByFormula,
};
