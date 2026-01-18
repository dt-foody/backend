const axios = require('axios');
const httpStatus = require('http-status');
const config = require('../config/config');
const ApiError = require('./ApiError');
// Import model DistanceCache
const { DistanceCache } = require('../models');

/**
 * Tính khoảng cách giữa 2 điểm dùng HERE Map API
 * Có caching vào Database để tiết kiệm request và giảm traffic
 * @param {Object} origin { lat, lng }
 * @param {Object} destination { lat, lng }
 * @returns {Promise<number>} distance in km
 */
const getDistanceInKm = async (origin, destination) => {
  try {
    // 1. Tạo key duy nhất để định danh cặp tọa độ
    // Format: "lat1,lng1_lat2,lng2"
    // Dùng chuỗi template string để đảm bảo format nhất quán
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;
    const cacheKey = `${originStr}_${destStr}`;

    // 2. Kiểm tra trong DB xem đã có kết quả cache chưa
    const cachedData = await DistanceCache.findOne({ key: cacheKey });

    if (cachedData) {
      // Nếu có rồi, trả về ngay lập tức, không cần gọi API
      return cachedData.distanceInKm;
    }

    // =======================================================
    // 3. Nếu chưa có trong Cache, mới thực hiện gọi API
    // =======================================================

    // Docs: https://developer.here.com/documentation/routing-api/dev_guide/topics/send-request.html
    const url = `https://router.hereapi.com/v8/routes?transportMode=scooter&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&return=summary&apiKey=${config.hereMap.apiKey}`;

    const response = await axios.get(url);

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('Không tìm thấy đường đi');
    }

    const { summary } = response.data.routes[0].sections[0];
    const distanceInMeter = summary.length;
    const distanceInKm = distanceInMeter / 1000;

    // 4. Lưu kết quả mới tính được vào DB để dùng cho lần sau
    // Sử dụng updateOne với upsert=true để an toàn hơn trong môi trường async (tránh lỗi duplicate key nếu có 2 request cùng lúc)
    await DistanceCache.updateOne(
      { key: cacheKey },
      {
        key: cacheKey,
        origin,
        destination,
        distanceInKm,
      },
      { upsert: true }
    );

    return distanceInKm;
  } catch (error) {
    // console.error('HERE Map API Error:', error.message);
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Không thể tính toán khoảng cách lúc này.');
  }
};

module.exports = {
  getDistanceInKm,
};
