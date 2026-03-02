import * as dotenv from 'dotenv';
import * as joi from 'joi';

dotenv.config();

interface EnvVars {
  NODE_ENV: 'test' | 'development' | 'production';
  PORT: number;

  DATABASE_URI: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  CLOUDINARY_URL?: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;

  FIREBASE_SERVICE_ACCOUNT_BASE64: string;

  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RECAPTCHA_SECRET_KEY?: string;
  ENCRYPTION_KEY: string;

  APP_URL?: string;
  ADMIN_DASHBOARD_URL?: string;
}

const schema = joi
  .object<EnvVars>({
    NODE_ENV: joi
      .string()
      .valid('test', 'development', 'production')
      .required(),
    PORT: joi.number().required(),

    DATABASE_URI: joi.string().required(),

    JWT_SECRET: joi.string().required(),
    JWT_EXPIRES_IN: joi.string().default('1d'),

    CLOUDINARY_URL: joi
      .string()
      .uri({ scheme: ['cloudinary'] })
      .optional(),
    CLOUDINARY_CLOUD_NAME: joi.string().required(),
    CLOUDINARY_API_KEY: joi.string().required(),
    CLOUDINARY_API_SECRET: joi.string().required(),

    FIREBASE_SERVICE_ACCOUNT_BASE64: joi.string().base64().required(),

    STRIPE_SECRET_KEY: joi.string().optional(),
    STRIPE_WEBHOOK_SECRET: joi.string().optional(),
    RECAPTCHA_SECRET_KEY: joi.string().optional(),
    ENCRYPTION_KEY: joi.string().length(32).required(),

    APP_URL: joi.string().uri().optional(),
    ADMIN_DASHBOARD_URL: joi.string().uri().optional(),
  })
  .unknown(true);

const validationResult = schema.validate(process.env, {
  abortEarly: false,
  convert: true,
});

if (validationResult.error) {
  throw new Error(
    `❌ Config validation error:\n${validationResult.error.message}`,
  );
}

const env: EnvVars = validationResult.value;

export const config = {
  env: {
    name: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
  server: {
    port: env.PORT,
  },
  database: {
    uri: env.DATABASE_URI,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  },
  app: {
    url: ((env.APP_URL ?? '').trim() || 'https://afrogoods.com') as string,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  cloudinary: {
    url: env.CLOUDINARY_URL || undefined,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  },
  firebase: {
    serviceAccountBase64: env.FIREBASE_SERVICE_ACCOUNT_BASE64,
  },
  recaptcha: {
    secretKey: env.RECAPTCHA_SECRET_KEY,
  },
  encryption: {
    key:
      (typeof env.ENCRYPTION_KEY === 'string' &&
        env.ENCRYPTION_KEY.length === 32)
        ? env.ENCRYPTION_KEY
        : 'dev-encryption-key-32-chars!!',
  },
  cors: {
    appUrl: env.APP_URL,
    adminDashboardUrl: env.ADMIN_DASHBOARD_URL,
  },
};
