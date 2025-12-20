// // src/common/providers/redis.provider.ts
// import { Provider } from '@nestjs/common';
// import Redis from 'ioredis';
// import { config } from 'src/config';

// export const REDIS_CLIENT = 'REDIS_CLIENT';

// export const RedisProvider: Provider = {
//   provide: REDIS_CLIENT,
//   useFactory: () => {
//     const redisOptions = config.redis.url
//       ? config.redis.url // Upstash: full redis(s):// URL with auth + TLS
//       : {
//           host: config.redis.host,
//           port: config.redis.port,
//           password: config.redis.password,
//           tls: config.env.isProd ? {} : undefined, // Enable TLS in production if using individual vars
//         };

//     const client = new Redis(redisOptions);

//     client.on('error', (err) => {
//       console.error('Redis connection error:', err);
//     });

//     client.on('connect', () => {
//       console.log('Redis connected successfully');
//     });

//     return client;
//   },
// };

// src/common/providers/redis.provider.ts
import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from 'src/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    let redisClient: Redis;

    if (config.redis.url) {
      redisClient = new Redis(config.redis.url);
    } else {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        tls: config.env.isProd ? {} : undefined,
      });
    }

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    return redisClient;
  },
};
