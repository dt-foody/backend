const { Customer, Employee } = require('../models');

const attachProfile = async (req, res, next) => {
  try {
    if (!req.user) return next();

    // Tránh query lại nếu đã attach
    if (req.profile) return next();

    let profile = null;
    let profileType = null;

    if (req.user.role === 'customer') {
      profile = await Customer.findOne({ user: req.user._id });
      profileType = 'Customer';
    } else {
      profile = await Employee.findOne({ user: req.user._id });
      profileType = 'Employee';
    }

    if (!profile) {
      return next();
    }

    req.profile = profile;
    req.profileType = profileType;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  attachProfile,
};
