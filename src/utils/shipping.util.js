const moment = require('moment');

function getTimeType(time) {
  const day = time.day(); // 0 CN, 1-6
  const minutes = time.hours() * 60 + time.minutes();

  if (minutes >= 22 * 60 || minutes < 6 * 60) {
    // 22:00 - 06:00
    return 'SLEEP BROTHER';
  }

  // ======================
  // 1. Giờ đêm / tối (mọi ngày)
  // ======================
  if (minutes >= 1170 && minutes < 1260) {
    // 19:30 - 21:00
    return 'NIGHT';
  }

  // ======================
  // 2. Thứ 2 - Thứ 6
  // ======================
  if (day >= 1 && day <= 5) {
    if (
      (minutes >= 450 && minutes < 540) || // 07:30 - 09:00
      (minutes >= 990 && minutes < 1080) || // 16:30 - 18:00
      (minutes >= 1080 && minutes < 1170) // 18:00 - 19:30
    ) {
      return 'PEAK';
    }
    return 'LOW';
  }

  // ======================
  // 3. Thứ 7
  // ======================
  if (day === 6) {
    if (
      (minutes >= 450 && minutes < 540) || // 07:30 - 09:00
      (minutes >= 720 && minutes < 810) || // 12:00 - 13:30
      (minutes >= 1080 && minutes < 1170) // 18:00 - 19:30
    ) {
      return 'PEAK';
    }
    return 'LOW';
  }

  // ======================
  // 4. Chủ nhật
  // ======================
  if (day === 0) {
    if (minutes >= 1080 && minutes < 1170) {
      // 18:00 - 19:30
      return 'PEAK';
    }
    return 'LOW';
  }

  return 'LOW';
}

/**
 * Tính tiền ship dựa trên công thức giờ cao điểm/đêm/thường
 * @param {number} distanceKm Quãng đường (km)
 * @returns {number} Tiền ship (VND)
 */
const calculateShippingFeeByFormula = (distanceKm, orderTime = null) => {
  const x = distanceKm;
  let shippingFee = 0;

  // [UPDATE] Nếu có orderTime truyền vào thì dùng, không thì dùng now
  // Sử dụng utcOffset(7) để cố định múi giờ Việt Nam (UTC+7)
  const timeToUse = orderTime ? moment(orderTime) : moment();
  const now = timeToUse.utcOffset(7);

  const timeType = getTimeType(now);

  // Khung giờ cao điểm
  const isPeakHour = timeType === 'PEAK';

  // Khung giờ đêm (22h-6h) - Áp dụng cả tuần
  const isNightHour = timeType === 'NIGHT';

  if (isPeakHour) {
    // Công thức: 500*(x^2+5x+42)
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
