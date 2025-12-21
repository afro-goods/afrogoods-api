// import { Inject, Injectable } from '@nestjs/common';
// import Redis from 'ioredis';
// import { REDIS_CLIENT } from '../providers/redis.provider';

// @Injectable()
// export class RedisService {
//   constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

//   async get(key: string): Promise<string | null> {
//     return this.redisClient.get(key);
//   }

//   async set(key: string, value: string, ttl?: number): Promise<'OK'> {
//     if (ttl) {
//       return this.redisClient.set(key, value, 'EX', ttl);
//     }
//     return this.redisClient.set(key, value);
//   }

//   async del(key: string): Promise<number> {
//     return this.redisClient.del(key);
//   }

//   async ping(): Promise<string> {
//     return this.redisClient.ping();
//   }

//   getClient(): Redis {
//     return this.redisClient;
//   }

//   async quit(): Promise<'OK'> {
//     return this.redisClient.quit();
//   }
// }
