import { Catch, ArgumentsHost, Logger } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData();

    this.logger.error(
      `WebSocket Exception: ${exception.message}`,
      exception.stack,
      `Client: ${client.id}, Data: ${JSON.stringify(data)}`,
    );

    // Determine error type and response
    let errorResponse: any;

    if (exception instanceof WsException) {
      errorResponse = {
        type: "error",
        message: exception.getError(),
        timestamp: new Date().toISOString(),
        clientId: client.id,
      };
    } else if (exception.name === "ValidationError") {
      errorResponse = {
        type: "validation_error",
        message: "Invalid data format",
        details: exception.message,
        timestamp: new Date().toISOString(),
        clientId: client.id,
      };
    } else if (exception.name === "UnauthorizedError") {
      errorResponse = {
        type: "unauthorized",
        message: "Authentication required",
        timestamp: new Date().toISOString(),
        clientId: client.id,
      };

      // Disconnect unauthorized clients
      setTimeout(() => client.disconnect(), 100);
    } else if (exception.name === "ForbiddenError") {
      errorResponse = {
        type: "forbidden",
        message: "Access denied",
        timestamp: new Date().toISOString(),
        clientId: client.id,
      };
    } else if (exception.name === "ThrottlerException") {
      errorResponse = {
        type: "rate_limit",
        message: "Rate limit exceeded",
        timestamp: new Date().toISOString(),
        clientId: client.id,
        retryAfter: 60, // seconds
      };
    } else {
      // Generic error
      errorResponse = {
        type: "internal_error",
        message: "An internal error occurred",
        timestamp: new Date().toISOString(),
        clientId: client.id,
        ...(process.env.NODE_ENV === "development" && {
          details: exception.message,
          stack: exception.stack,
        }),
      };
    }

    // Emit error to client
    client.emit("error", errorResponse);

    // Log error metrics
    this.logErrorMetrics(exception, client.id);
  }

  private logErrorMetrics(exception: any, clientId: string): void {
    // This could integrate with your metrics system
    const errorMetric = {
      type: "websocket_error",
      errorType: exception.name || "unknown",
      message: exception.message,
      clientId,
      timestamp: new Date().toISOString(),
    };

    // Example: Send to monitoring service
    // this.metricsService.recordError(errorMetric);

    this.logger.debug(`Error metric recorded: ${JSON.stringify(errorMetric)}`);
  }
}
