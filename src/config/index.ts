import * as dotenv from 'dotenv';
import * as joi from 'joi';

dotenv.config();

interface EnvVars {
  NODE_ENV: 'test' | 'development' | 'production';
  PORT: number;

  DATABASE_URI: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  REDIS_HOST: string;
  REDIS_PORT: number;
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

    REDIS_HOST: joi.string().required(),
    REDIS_PORT: joi.number().required(),
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
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
};
