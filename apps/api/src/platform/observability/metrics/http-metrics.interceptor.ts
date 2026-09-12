import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import type { Observable } from 'rxjs';
import { resolveRequestRouteTemplate, type RequestRouteShape } from '../logging/request-route.js';
import { HttpMetricsService } from './http-metrics.service.js';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: HttpMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestRouteShape & { method: string }>();
    const response = http.getResponse<Pick<ServerResponse, 'once' | 'statusCode'>>();
    const route = resolveRequestRouteTemplate(request);
    const startedAt = process.hrtime.bigint();
    const finishInFlight = this.safeStartRequest(route);
    let finalized = false;

    const finalize = () => {
      if (finalized) {
        return;
      }
      finalized = true;
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      try {
        this.metrics.recordRequest({
          durationSeconds,
          method: request.method,
          route,
          statusCode: response.statusCode,
        });
      } catch {
        // Metrics must never affect product request handling.
      } finally {
        finishInFlight();
      }
    };

    response.once('finish', finalize);
    response.once('close', finalize);

    return next.handle();
  }

  private safeStartRequest(route: string): () => void {
    try {
      return this.metrics.startRequest(route);
    } catch {
      return () => undefined;
    }
  }
}
