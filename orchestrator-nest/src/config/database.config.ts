import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    // Check if DATABASE_URL is provided (Docker environment)
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
      const url = new URL(databaseUrl);
      
      return {
        type: 'postgres',
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        username: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading '/'
        ssl: false, // Docker internal communication doesn't need SSL
        synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
        logging: process.env.DB_LOGGING === 'true' || false,
        migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true' || true,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
        subscribers: [__dirname + '/../**/*.subscriber{.ts,.js}'],
        extra: {
          // Connection pool configuration
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      };
    }
    
    // Fallback to individual environment variables
    const config = this.configService.get('database');
    
    return {
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      synchronize: config.synchronize,
      logging: config.logging,
      migrationsRun: config.migrationsRun,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      subscribers: [__dirname + '/../**/*.subscriber{.ts,.js}'],
      extra: {
        // Connection pool configuration
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
    };
  }
}

// Export DataSource for CLI operations
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'n8nwork',
  password: process.env.DB_PASSWORD || 'n8nwork_dev',
  database: process.env.DB_DATABASE || 'n8nwork',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  subscribers: [__dirname + '/../**/*.subscriber{.ts,.js}'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
