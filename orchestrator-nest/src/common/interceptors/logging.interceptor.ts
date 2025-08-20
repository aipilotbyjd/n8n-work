import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { trace, context } from '@opentelemetry/api';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
    const request = executionContext.switchToHttp().getRequest<Request>();
    const response = executionContext.switchToHttp().getResponse<Response>();
    
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();
    
    // Get current span for tracing
    const span = trace.getActiveSpan();
    const traceId = span?.spanContext().traceId;
    const spanId = span?.spanContext().spanId;

    // Extract user information if available
    const userId = (request as any).user?.id;
    const tenantId = (request as any).user?.tenantId;

    // Log request
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

    // Add request attributes to span
    if (span) {
      span.setAttributes({
        'http.method': method,
        'http.url': url,
        'http.user_agent': userAgent,
        'user.id': userId || '',
        'tenant.id': tenantId || '',
      });
    }

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          // Log successful response
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

          // Add response attributes to span
          if (span) {
            span.setAttributes({
              'http.status_code': statusCode,
              'http.response_time_ms': duration,
            });
            
            span.setStatus({ 
              code: statusCode < 400 ? 1 : 2, // OK or ERROR
              message: statusCode < 400 ? 'OK' : 'Request failed' 
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;

          // Log error response
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

          // Add error attributes to span
          if (span) {
            span.setAttributes({
              'http.status_code': statusCode,
              'http.response_time_ms': duration,
              'error': true,
              'error.message': error.message,
            });
            
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message }); // ERROR
          }
        },
      }),
    );
  }
}
