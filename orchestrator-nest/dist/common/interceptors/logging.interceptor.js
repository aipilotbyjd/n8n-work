"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LoggingInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const api_1 = require("@opentelemetry/api");
let LoggingInterceptor = LoggingInterceptor_1 = class LoggingInterceptor {
    logger = new common_1.Logger(LoggingInterceptor_1.name);
    intercept(executionContext, next) {
        const request = executionContext.switchToHttp().getRequest();
        const response = executionContext.switchToHttp().getResponse();
        const { method, url, ip, headers } = request;
        const userAgent = headers['user-agent'] || '';
        const startTime = Date.now();
        const span = api_1.trace.getActiveSpan();
        const traceId = span?.spanContext().traceId;
        const spanId = span?.spanContext().spanId;
        const userId = request.user?.id;
        const tenantId = request.user?.tenantId;
        this.logger.log('Incoming request', {
            method,
            url,
            ip,
            userAgent,
            userId,
            tenantId,
            traceId,
            spanId,
            timestamp: new Date().toISOString(),
        });
        if (span) {
            span.setAttributes({
                'http.method': method,
                'http.url': url,
                'http.user_agent': userAgent,
                'user.id': userId || '',
                'tenant.id': tenantId || '',
            });
        }
        return next.handle().pipe((0, operators_1.tap)({
            next: (responseBody) => {
                const duration = Date.now() - startTime;
                const { statusCode } = response;
                this.logger.log('Request completed', {
                    method,
                    url,
                    statusCode,
                    duration: `${duration}ms`,
                    userId,
                    tenantId,
                    traceId,
                    spanId,
                    timestamp: new Date().toISOString(),
                });
                if (span) {
                    span.setAttributes({
                        'http.status_code': statusCode,
                        'http.response_time_ms': duration,
                    });
                    span.setStatus({
                        code: statusCode < 400 ? 1 : 2,
                        message: statusCode < 400 ? 'OK' : 'Request failed'
                    });
                }
            },
            error: (error) => {
                const duration = Date.now() - startTime;
                const statusCode = response.statusCode || 500;
                this.logger.error('Request failed', {
                    method,
                    url,
                    statusCode,
                    duration: `${duration}ms`,
                    error: error.message,
                    userId,
                    tenantId,
                    traceId,
                    spanId,
                    timestamp: new Date().toISOString(),
                });
                if (span) {
                    span.setAttributes({
                        'http.status_code': statusCode,
                        'http.response_time_ms': duration,
                        'error': true,
                        'error.message': error.message,
                    });
                    span.recordException(error);
                    span.setStatus({ code: 2, message: error.message });
                }
            },
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = LoggingInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], LoggingInterceptor);
//# sourceMappingURL=logging.interceptor.js.map