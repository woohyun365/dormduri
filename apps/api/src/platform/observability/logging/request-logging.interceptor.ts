import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ServerResponse } from 'node:http';
import type { Observable } from 'rxjs';
import { AppLoggerService } from './app-logger.service.js';
import { statusClassFromStatusCode } from './log-event.js';
import { resolveExecutionRouteTemplate } from './request-route.js';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string }>();
    const response = http.getResponse<Pick<ServerResponse, 'once' | 'statusCode'>>();
    const route = resolveExecutionRouteTemplate(context, this.reflector);
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statusCode = response.statusCode;
      try {
        this.logger.write(
          statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
          {
            durationMs,
            method: request.method,
            operation: 'http_request',
            outcome: statusCode >= 400 ? 'failure' : 'success',
            route,
            statusClass: statusClassFromStatusCode(statusCode),
            statusCode,
          },
          'http request completed',
        );
      } catch {
        // Logging must never affect product request handling.
      }
    });

    return next.handle();
  }
}
