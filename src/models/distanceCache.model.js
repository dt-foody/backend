const mongoose = require('mongoose');
const { toJSON } = require('./plugins'); // Sử dụng plugin toJSON nếu dự án có sẵn

const distanceCacheSchema = mongoose.Schema(
  {
    // Key định danh duy nhất cho cặp tọa độ: "lat1,lng1_lat2,lng2"
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    distanceInKm: {
      type: Number,
      required: true,
    },
    origin: {
      lat: Number,
      lng: Number,
    },
    destination: {
      lat: Number,
      lng: Number,
    },
  },
  {
    timestamps: true, // Để biết được record này được cache khi nào
  }
);

// Add plugin convert mongoose to json (nếu có)
if (toJSON) {
  distanceCacheSchema.plugin(toJSON);
}

const DistanceCache = mongoose.model('DistanceCache', distanceCacheSchema);

module.exports = DistanceCache;
