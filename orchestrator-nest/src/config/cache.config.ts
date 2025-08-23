import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const cacheConfig: CacheModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => {
    const environment = configService.get('app.environment');
    
    // In production/staging, try to use Redis
    if (environment === 'production' || environment === 'staging') {
      try {
        const { redisStore } = await import('cache-manager-redis-yet');
        const redisConfig = configService.get('redis');
        
        return {
          store: redisStore,
          url: `redis://${redisConfig.password ? `:${redisConfig.password}@` : ''}${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`,
          keyPrefix: redisConfig.keyPrefix,
          ttl: 300 * 1000, // 5 minutes in milliseconds
          max: 100,
        };
      } catch (error) {
        console.warn('Redis cache not available, falling back to in-memory cache:', error.message);
      }
    }
    
    // Default to in-memory cache for development or if Redis fails
    return {
      ttl: 300 * 1000, // 5 minutes in milliseconds
      max: 100, // maximum number of items in cache
    };
  },
  inject: [ConfigService],
  isGlobal: true,
};