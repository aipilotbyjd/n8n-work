import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { QueryFailedError } from "typeorm";
import { trace } from "@opentelemetry/api";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const span = trace.getActiveSpan();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let code = "INTERNAL_ERROR";
    let details: any = undefined;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || exception.message;
        code = responseObj.code || this.getErrorCodeFromStatus(status);
        details = responseObj.details;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = "Database query failed";
      code = "DATABASE_ERROR";

      // Don't expose sensitive database information in production
      if (process.env.NODE_ENV !== "production") {
        details = {
          query: exception.query,
          parameters: exception.parameters,
          driverError: exception.driverError?.message,
        };
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name || "UNKNOWN_ERROR";

      if (process.env.NODE_ENV !== "production") {
        details = {
          stack: exception.stack,
        };
      }
    }

    // Extract trace information
    const traceId = span?.spanContext().traceId;
    const spanId = span?.spanContext().spanId;

    // Log the error
    const errorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      message,
      code,
      traceId,
      spanId,
      userAgent: request.get("user-agent"),
      ip: request.ip,
      userId: (request as any).user?.id,
      tenantId: (request as any).user?.tenantId,
    };

    // Log error with appropriate level
    if (status >= 500) {
      this.logger.error("Server error occurred", {
        ...errorLog,
        error: exception,
        stack: exception instanceof Error ? exception.stack : undefined,
      });

      // Record span error
      span?.recordException(
        exception instanceof Error ? exception : new Error(String(exception)),
      );
      span?.setStatus({ code: 2, message }); // ERROR
    } else if (status >= 400) {
      this.logger.warn("Client error occurred", errorLog);
    }

    // Prepare response
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

    // Set status and send response
    response.status(status).json(errorResponse);
  }

  private getErrorCodeFromStatus(status: number): string {
    const statusCodeMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "VALIDATION_ERROR",
      429: "RATE_LIMIT_EXCEEDED",
      500: "INTERNAL_ERROR",
      502: "BAD_GATEWAY",
      503: "SERVICE_UNAVAILABLE",
      504: "GATEWAY_TIMEOUT",
    };

    return statusCodeMap[status] || "UNKNOWN_ERROR";
  }
}
