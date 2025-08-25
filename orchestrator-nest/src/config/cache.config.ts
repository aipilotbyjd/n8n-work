import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';

@Injectable()
export class CacheConfig implements CacheOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions> {
    const cacheConfig = this.config.get('cache');
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
      } catch (err) {
        // redis not installed
      }
    }
    return {
      ttl: cacheConfig.ttl,
      max: cacheConfig.max,
    };
  }
}
