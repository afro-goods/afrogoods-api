import type { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from 'src/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    let redisClient: Redis;

    const commonOptions = {
      maxRetriesPerRequest: null, // Required for BullMQ shared connection
      enableOfflineQueue: false, // Recommended for cloud Redis (Upstash)
      lazyConnect: true,
      retryStrategy: (times: number) => {
        // Reconnect after increasing delays, max 30 seconds
        const delay = Math.min(times * 1000, 30000);
        return delay;
      },
    };

    if (config.redis.url) {
      redisClient = new Redis(config.redis.url, commonOptions);
    } else {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        tls: config.env.isProd ? {} : undefined,
        ...commonOptions,
      });
    }

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('error', (err: any) => {
      // Silently ignore ECONNRESET - common in local dev, Redis will auto-reconnect
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        return;
      }
      console.error('Redis connection error:', err.message);
    });

    redisClient.on('reconnecting', () => {
      if (!config.env.isProd) {
        console.log('Redis reconnecting...');
      }
    });

    return redisClient;
  },
};
