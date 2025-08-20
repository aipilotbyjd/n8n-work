"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const api_1 = require("@opentelemetry/api");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const span = api_1.trace.getActiveSpan();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let code = 'INTERNAL_ERROR';
        let details = undefined;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            }
            else if (typeof exceptionResponse === 'object') {
                const responseObj = exceptionResponse;
                message = responseObj.message || responseObj.error || exception.message;
                code = responseObj.code || this.getErrorCodeFromStatus(status);
                details = responseObj.details;
            }
        }
        else if (exception instanceof typeorm_1.QueryFailedError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = 'Database query failed';
            code = 'DATABASE_ERROR';
            if (process.env.NODE_ENV !== 'production') {
                details = {
                    query: exception.query,
                    parameters: exception.parameters,
                    driverError: exception.driverError?.message,
                };
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
            code = exception.name || 'UNKNOWN_ERROR';
            if (process.env.NODE_ENV !== 'production') {
                details = {
                    stack: exception.stack,
                };
            }
        }
        const traceId = span?.spanContext().traceId;
        const spanId = span?.spanContext().spanId;
        const errorLog = {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            statusCode: status,
            message,
            code,
            traceId,
            spanId,
            userAgent: request.get('user-agent'),
            ip: request.ip,
            userId: request.user?.id,
            tenantId: request.user?.tenantId,
        };
        if (status >= 500) {
            this.logger.error('Server error occurred', {
                ...errorLog,
                error: exception,
                stack: exception instanceof Error ? exception.stack : undefined,
            });
            span?.recordException(exception instanceof Error ? exception : new Error(String(exception)));
            span?.setStatus({ code: 2, message });
        }
        else if (status >= 400) {
            this.logger.warn('Client error occurred', errorLog);
        }
        const errorResponse = {
            success: false,
            error: {
                code,
                message,
                statusCode: status,
                timestamp: new Date().toISOString(),
                path: request.url,
                traceId,
                ...(details && { details }),
            },
        };
        response.status(status).json(errorResponse);
    }
    getErrorCodeFromStatus(status) {
        const statusCodeMap = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'VALIDATION_ERROR',
            429: 'RATE_LIMIT_EXCEEDED',
            500: 'INTERNAL_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
            504: 'GATEWAY_TIMEOUT',
        };
        return statusCodeMap[status] || 'UNKNOWN_ERROR';
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map