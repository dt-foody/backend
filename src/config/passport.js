const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('./config');
const { tokenTypes } = require('./tokens');
const { User } = require('../models');

function customExtractor(req) {
  // 1) Ưu tiên lấy Bearer token
  const authToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

  if (authToken) return authToken;

  // 2) Không có thì lấy từ cookie
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
}

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: customExtractor,
};

const jwtVerify = async (payload, done) => {
  try {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return done(null, false);
    }

    user.id = user._id;
    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

module.exports = {
  jwtStrategy,
};
