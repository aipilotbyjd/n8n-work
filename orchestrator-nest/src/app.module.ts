
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';

// Configuration
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { DatabaseConfig } from './config/database.config';
import { CacheConfig } from './config/cache.config';

// Common modules
import { ObservabilityModule } from './observability/observability.module';
import { MessageQueueModule } from './mq/message-queue.module';

// Domain modules
import { AuthModule } from './domains/auth/auth.module';
import { TenantsModule } from './domains/tenants/tenants.module';
import { WorkflowsModule } from './domains/workflows/workflows.module';
import { ExecutionsModule } from './domains/executions/executions.module';
import { WebhooksModule } from './domains/webhooks/webhooks.module';
import { CredentialsModule } from './domains/credentials/credentials.module';
import { MarketplaceModule } from './domains/marketplace/marketplace.module';
import { PoliciesModule } from './domains/policies/policies.module';
import { BillingModule } from './domains/billing/billing.module';
import { AuditModule } from './domains/audit/audit.module';

// Security
import { SecurityService } from './security/security.service';

// Health check
import { HealthController } from './health.controller';

// Global filters and interceptors
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Core providers
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionEngineModule } from './domains/execution-engine/execution-engine.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfig,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Event emitter
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Health checks
    TerminusModule,

    // Cache configuration - Simple in-memory cache
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useClass: CacheConfig,
      isGlobal: true,
    }),

    // Core modules
    ObservabilityModule,
    MessageQueueModule,

    // Domain modules
    AuthModule,
    TenantsModule,
    WorkflowsModule,
    ExecutionsModule,
    WebhooksModule,
    CredentialsModule,
    MarketplaceModule,
    PoliciesModule,
    BillingModule,
    AuditModule,
    ExecutionEngineModule,
    AiAgentsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Core services
    SecurityService,
  ],
  exports: [SecurityService],
})
export class AppModule { }
orts: [SecurityService],
})
export class AppModule { }
