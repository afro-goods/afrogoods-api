import * as dotenv from 'dotenv';
import * as joi from 'joi';

dotenv.config();

interface EnvVars {
  NODE_ENV: 'test' | 'development' | 'production';
  PORT: number;

  DATABASE_URI: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  REDIS_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;

  CLOUDINARY_URL?: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;

  FIREBASE_SERVICE_ACCOUNT_BASE64: string;
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

    REDIS_URL: joi
      .string()
      .uri({ scheme: ['redis', 'rediss'] })
      .optional(),
    REDIS_HOST: joi.string().required(),
    REDIS_PORT: joi.number().required(),
    REDIS_PASSWORD: joi.string().allow('').optional(),

    CLOUDINARY_URL: joi
      .string()
      .uri({ scheme: ['cloudinary'] })
      .optional(),
    CLOUDINARY_CLOUD_NAME: joi.string().required(),
    CLOUDINARY_API_KEY: joi.string().required(),
    CLOUDINARY_API_SECRET: joi.string().required(),

    FIREBASE_SERVICE_ACCOUNT_BASE64: joi.string().base64().required(),
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
  redis: {
    url: env.REDIS_URL || undefined,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
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
};
