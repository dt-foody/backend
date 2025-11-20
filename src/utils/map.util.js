const axios = require('axios');
const httpStatus = require('http-status');
const config = require('../config/config');
const ApiError = require('./ApiError');

/**
 * Tính khoảng cách giữa 2 điểm dùng HERE Map API
 * @param {Object} origin { lat, lng }
 * @param {Object} destination { lat, lng }
 * @returns {Promise<number>} distance in km
 */
const getDistanceInKm = async (origin, destination) => {
  try {
    // Docs: https://developer.here.com/documentation/routing-api/dev_guide/topics/send-request.html
    const url = `https://router.hereapi.com/v8/routes?transportMode=scooter&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&return=summary&apiKey=${config.hereMap.apiKey}`;

    const response = await axios.get(url);

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('Không tìm thấy đường đi');
    }

    const { summary } = response.data.routes[0].sections[0];
    const distanceInMeter = summary.length;

    return distanceInMeter / 1000;
  } catch (error) {
    // console.error('HERE Map API Error:', error.message);
    // Tuỳ policy dự án, có thể ném lỗi hoặc trả về khoảng cách đường chim bay (Haversine) làm fallback
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Không thể tính toán khoảng cách lúc này.');
  }
};

module.exports = {
  getDistanceInKm,
};
