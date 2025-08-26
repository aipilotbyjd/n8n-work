import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';

@Injectable()
export class CacheConfig implements CacheOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions> {
    const cacheConfig = this.config.get('cache') || {
      driver: 'memory',
      redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      ttl: 3600, // 1 hour in seconds
      max: 1000
    };
    
    if (cacheConfig.driver === 'redis') {
      try {
        const { redisStore } = await import('cache-manager-redis-yet');
        return {
          store: redisStore,
          host: cacheConfig.redis.host,
          port: cacheConfig.redis.port,
          password: cacheConfig.redis.password,
          ttl: cacheConfig.ttl,
          max: cacheConfig.max,
        };
      } catch (error) {
        console.warn('Redis store not available, falling back to memory cache:', error.message);
      }
    }
    
    // Default to memory cache
    return {
      ttl: cacheConfig.ttl,
      max: cacheConfig.max,
    };
  }
}
