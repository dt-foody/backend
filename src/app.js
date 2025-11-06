const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const routesPublic = require('./routes/v1/public');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

app.use(cookieParser());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// 1. Danh sách các origin được phép
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:4000',
  'https://luuchi.vercel.app',
  'https://web-admin-sandy.vercel.app',
];

const corsOptions = {
  // origin: (origin, callback) => {
  //   if (!origin || allowedOrigins.includes(origin)) {
  //     callback(null, true);
  //   } else {
  //     callback(new Error('Not allowed by CORS'));
  //   }
  // },
  origin: allowedOrigins,
  credentials: true,
};

// 3. Áp dụng
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Cho phép pre-flight

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}
if (config.env === 'production') {
  app.use('/v1/public/auth', authLimiter);
}

// v1 api routes
app.use('/v1', routesPublic);
app.use('/v1/admin', routes);
app.use('/public', express.static(path.join(__dirname, '../public')));

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
