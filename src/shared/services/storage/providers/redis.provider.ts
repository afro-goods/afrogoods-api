import type { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from 'src/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    let redisClient: Redis;

    if (config.redis.url) {
      redisClient = new Redis(config.redis.url, {
        maxRetriesPerRequest: null, // ← REQUIRED for BullMQ shared connection
        enableOfflineQueue: false, // ← Recommended for Upstash
        lazyConnect: true,
      });
    } else {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        tls: config.env.isProd ? {} : undefined,
        maxRetriesPerRequest: null, // ← Also here for consistency
        enableOfflineQueue: false,
      });
    }

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('error', (err: any) => {
      if (err.code === 'ECONNRESET') {
        return;
      }
      console.error('Redis connection error:', err);
    });

    return redisClient;
  },
};
