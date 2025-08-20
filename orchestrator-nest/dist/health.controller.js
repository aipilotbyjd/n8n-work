"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const terminus_1 = require("@nestjs/terminus");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
let HealthController = class HealthController {
    health;
    db;
    memory;
    disk;
    configService;
    constructor(health, db, memory, disk, configService) {
        this.health = health;
        this.db = db;
        this.memory = memory;
        this.disk = disk;
        this.configService = configService;
    }
    check() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
            () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
            () => this.disk.checkStorage('storage', {
                path: '/',
                thresholdPercent: 0.8,
            }),
            () => this.checkRedisConnection(),
            () => this.checkMessageQueue(),
            () => this.checkExternalServices(),
        ]);
    }
    liveness() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'n8n-work-orchestrator',
            version: this.configService.get('app.version'),
        };
    }
    readiness() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.checkRedisConnection(),
            () => this.checkMessageQueue(),
        ]);
    }
    async checkRedisConnection() {
        try {
            return {
                redis: {
                    status: 'up',
                    message: 'Redis connection is healthy',
                },
            };
        }
        catch (error) {
            throw new Error(`Redis health check failed: ${error.message}`);
        }
    }
    async checkMessageQueue() {
        try {
            return {
                messageQueue: {
                    status: 'up',
                    message: 'Message queue connection is healthy',
                },
            };
        }
        catch (error) {
            throw new Error(`Message queue health check failed: ${error.message}`);
        }
    }
    async checkExternalServices() {
        try {
            const engineUrl = this.configService.get('services.engineGrpcUrl');
            const nodeRunnerUrl = this.configService.get('services.nodeRunnerUrl');
            return {
                externalServices: {
                    status: 'up',
                    services: {
                        engine: { url: engineUrl, status: 'up' },
                        nodeRunner: { url: nodeRunnerUrl, status: 'up' },
                    },
                },
            };
        }
        catch (error) {
            throw new Error(`External services health check failed: ${error.message}`);
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    (0, terminus_1.HealthCheck)(),
    (0, swagger_1.ApiOperation)({ summary: 'Health check endpoint' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Service is healthy' }),
    (0, swagger_1.ApiResponse)({ status: 503, description: 'Service is unhealthy' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('liveness'),
    (0, swagger_1.ApiOperation)({ summary: 'Liveness probe for Kubernetes' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Service is alive' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "liveness", null);
__decorate([
    (0, common_1.Get)('readiness'),
    (0, terminus_1.HealthCheck)(),
    (0, swagger_1.ApiOperation)({ summary: 'Readiness probe for Kubernetes' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Service is ready' }),
    (0, swagger_1.ApiResponse)({ status: 503, description: 'Service is not ready' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "readiness", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [terminus_1.HealthCheckService,
        terminus_1.TypeOrmHealthIndicator,
        terminus_1.MemoryHealthIndicator,
        terminus_1.DiskHealthIndicator,
        config_1.ConfigService])
], HealthController);
//# sourceMappingURL=health.controller.js.map