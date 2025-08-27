import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { trace } from "@opentelemetry/api";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    timestamp: string;
    traceId?: string;
    version: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const span = trace.getActiveSpan();
    const traceId = span?.spanContext().traceId;

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          traceId,
          version: "1.0",
        },
      })),
    );
  }
}
