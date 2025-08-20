import { HealthCheckService, TypeOrmHealthIndicator, MemoryHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
export declare class HealthController {
    private health;
    private db;
    private memory;
    private disk;
    private configService;
    constructor(health: HealthCheckService, db: TypeOrmHealthIndicator, memory: MemoryHealthIndicator, disk: DiskHealthIndicator, configService: ConfigService);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult>;
    liveness(): {
        status: string;
        timestamp: string;
        service: string;
        version: any;
    };
    readiness(): Promise<import("@nestjs/terminus").HealthCheckResult>;
    private checkRedisConnection;
    private checkMessageQueue;
    private checkExternalServices;
}
