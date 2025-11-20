const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),
    SMTP_HOST: Joi.string().description('server that will send the emails'),
    SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    PAYOS_CLIENT_ID: Joi.string().description('PayOS Client Id'),
    PAYOS_API_KEY: Joi.string().description('PayOS Api Key'),
    PAYOS_CHECKSUM_KEY: Joi.string().description('PayOS Checksum Key'),
    REDIRECT_PAYMENT_SUCCESS: Joi.string().description('PayOS Redirect Payment Success'),
    REDIRECT_PAYMENT_FAIL: Joi.string().description('PayOS Redirect Payment Cancel'),
    HERE_MAP_API_KEY: Joi.string().description('HERE Map API Key'),
    STORE_LAT: Joi.number().default(10.7769).description('Store Latitude'), // Ví dụ: Chợ Bến Thành
    STORE_LNG: Joi.number().default(106.7009).description('Store Longitude'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  payos: {
    client_id: envVars.PAYOS_CLIENT_ID,
    api_key: envVars.PAYOS_API_KEY,
    checksum_key: envVars.PAYOS_CHECKSUM_KEY,
    redirect_payment_success: envVars.REDIRECT_PAYMENT_SUCCESS,
    redirect_payment_cancel: envVars.REDIRECT_PAYMENT_FAIL,
  },
  hereMap: {
    apiKey: envVars.HERE_MAP_API_KEY,
    storeLocation: {
      lat: envVars.STORE_LAT,
      lng: envVars.STORE_LNG,
    },
  },
};
