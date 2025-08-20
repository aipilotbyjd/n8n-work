"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const terminus_1 = require("@nestjs/terminus");
const configuration_1 = require("./config/configuration");
const validation_schema_1 = require("./config/validation.schema");
const database_config_1 = require("./config/database.config");
const observability_module_1 = require("./observability/observability.module");
const message_queue_module_1 = require("./mq/message-queue.module");
const auth_module_1 = require("./domains/auth/auth.module");
const tenants_module_1 = require("./domains/tenants/tenants.module");
const workflows_module_1 = require("./domains/workflows/workflows.module");
const executions_module_1 = require("./domains/executions/executions.module");
const webhooks_module_1 = require("./domains/webhooks/webhooks.module");
const credentials_module_1 = require("./domains/credentials/credentials.module");
const marketplace_module_1 = require("./domains/marketplace/marketplace.module");
const policies_module_1 = require("./domains/policies/policies.module");
const billing_module_1 = require("./domains/billing/billing.module");
const audit_module_1 = require("./domains/audit/audit.module");
const health_controller_1 = require("./health.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.configuration],
                validationSchema: validation_schema_1.validationSchema,
                validationOptions: {
                    allowUnknown: true,
                    abortEarly: true,
                },
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useClass: database_config_1.DatabaseConfig,
            }),
            throttler_1.ThrottlerModule.forRoot([
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
            schedule_1.ScheduleModule.forRoot(),
            event_emitter_1.EventEmitterModule.forRoot({
                wildcard: false,
                delimiter: '.',
                newListener: false,
                removeListener: false,
                maxListeners: 10,
                verboseMemoryLeak: false,
                ignoreErrors: false,
            }),
            terminus_1.TerminusModule,
            observability_module_1.ObservabilityModule,
            message_queue_module_1.MessageQueueModule,
            auth_module_1.AuthModule,
            tenants_module_1.TenantsModule,
            workflows_module_1.WorkflowsModule,
            executions_module_1.ExecutionsModule,
            webhooks_module_1.WebhooksModule,
            credentials_module_1.CredentialsModule,
            marketplace_module_1.MarketplaceModule,
            policies_module_1.PoliciesModule,
            billing_module_1.BillingModule,
            audit_module_1.AuditModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map