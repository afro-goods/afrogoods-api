import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../storage/providers/redis.provider';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Check if error is a connection-related error (expected during reconnection)
   */
  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      "Stream isn't writeable",
    ];
    const errorMessage = error?.message || '';
    return connectionErrors.some((e) => errorMessage.includes(e));
  }

  /**
   * Retrieve cached data by key
   * @returns Parsed data or null if not found/error
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      // Silently ignore connection errors (expected during reconnection)
      if (!this.isConnectionError(error)) {
        this.logger.error(`Cache get error for key ${key}:`, error);
      }
      return null;
    }
  }

  /**
   * Store data in cache with TTL
   * @returns true on success, false on error
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      if (!this.isConnectionError(error)) {
        this.logger.error(`Cache set error for key ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * Delete a specific cache entry
   * @returns true if deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      if (!this.isConnectionError(error)) {
        this.logger.error(`Cache delete error for key ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * Delete all entries matching a pattern
   * Uses SCAN to avoid blocking operations
   * @returns Number of deleted keys
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      return deletedCount;
    } catch (error) {
      if (!this.isConnectionError(error)) {
        this.logger.error(`Cache deleteByPattern error for ${pattern}:`, error);
      }
      return 0;
    }
  }
}
