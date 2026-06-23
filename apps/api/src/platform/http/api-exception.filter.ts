import { Catch, type ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { normalizeApiError } from './api-error.js';
import { AppLoggerService } from '../observability/logging/app-logger.service.js';
import { mapExceptionToLogEvent } from '../observability/logging/exception-log.mapper.js';
import { HttpMetricsService } from '../observability/metrics/http-metrics.service.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly metrics: HttpMetricsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const normalized = normalizeApiError(exception);
    const path = request.originalUrl ?? request.url;
    const retryAfterSeconds = resolveRetryAfterSeconds(response, normalized);
    if (retryAfterSeconds !== undefined) {
      setRetryAfterHeader(response, retryAfterSeconds);
    }

    const body = {
      success: false as const,
      error: normalized.error,
      code: normalized.code,
      statusCode: normalized.statusCode,
      timestamp: new Date().toISOString(),
      path,
      ...normalized.extras,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    };

    this.logException(request, normalized);
    this.recordExceptionMetric(normalized);
    response.status(normalized.statusCode).json(body);
  }

  private logException(request: Request, normalized: ReturnType<typeof normalizeApiError>) {
    const { event, level, message } = mapExceptionToLogEvent(request, normalized);
    try {
      this.logger.write(level, event, message);
    } catch {
      // Logging must never affect product error responses.
    }
  }

  private recordExceptionMetric(normalized: ReturnType<typeof normalizeApiError>) {
    try {
      this.metrics.recordException({
        code: normalized.code,
        domain: 'platform',
        statusCode: normalized.statusCode,
      });
    } catch {
      // Metrics must never affect product error responses.
    }
  }
}

function resolveRetryAfterSeconds(
  response: Response,
  normalized: ReturnType<typeof normalizeApiError>,
): number | undefined {
  if (normalized.statusCode !== 429) return undefined;

  const extrasRetryAfter = coercePositiveInteger(normalized.extras.retryAfterSeconds);
  if (extrasRetryAfter !== undefined) return extrasRetryAfter;

  return coercePositiveInteger(getRetryAfterHeader(response));
}

function getRetryAfterHeader(response: Response): unknown {
  const readableResponse = response as unknown as { getHeader?: (name: string) => unknown };
  return typeof readableResponse.getHeader === 'function'
    ? readableResponse.getHeader('Retry-After')
    : undefined;
}

function setRetryAfterHeader(response: Response, retryAfterSeconds: number): void {
  const writableResponse = response as unknown as {
    setHeader?: (name: string, value: number) => unknown;
  };
  if (typeof writableResponse.setHeader === 'function') {
    writableResponse.setHeader('Retry-After', retryAfterSeconds);
  }
}

function coercePositiveInteger(value: unknown): number | undefined {
  const rawValue: unknown = Array.isArray(value) ? (value as readonly unknown[])[0] : value;
  const numberValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return Math.ceil(numberValue);
}
