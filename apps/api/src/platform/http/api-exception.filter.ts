import { Catch, type ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost, type AbstractHttpAdapter } from '@nestjs/core';
import { normalizeApiError } from './api-error.js';
import { AppLoggerService } from '../observability/logging/app-logger.service.js';
import {
  mapExceptionToLogEvent,
  type ExceptionLogRequest,
} from '../observability/logging/exception-log.mapper.js';
import { HttpMetricsService } from '../observability/metrics/http-metrics.service.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly metrics: HttpMetricsService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<ExceptionLogRequest & { originalUrl?: string; url: string }>();
    const response = ctx.getResponse<unknown>();
    const { httpAdapter } = this.adapterHost;
    const normalized = normalizeApiError(exception);
    const path = request.originalUrl ?? request.url;
    const retryAfterSeconds = resolveRetryAfterSeconds(httpAdapter, response, normalized);
    if (retryAfterSeconds !== undefined) {
      httpAdapter.setHeader(response, 'Retry-After', String(retryAfterSeconds));
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
    httpAdapter.setHeader(response, 'Content-Type', 'application/json');
    httpAdapter.reply(response, body, body.statusCode);
  }

  private logException(
    request: ExceptionLogRequest,
    normalized: ReturnType<typeof normalizeApiError>,
  ) {
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
  adapter: AbstractHttpAdapter,
  response: unknown,
  normalized: ReturnType<typeof normalizeApiError>,
): number | undefined {
  if (![429, 503].includes(normalized.statusCode)) return undefined;

  const extrasRetryAfter = coercePositiveInteger(normalized.extras.retryAfterSeconds);
  if (extrasRetryAfter !== undefined) return extrasRetryAfter;

  return coercePositiveInteger(adapter.getHeader(response, 'Retry-After'));
}

function coercePositiveInteger(value: unknown): number | undefined {
  const rawValue: unknown = Array.isArray(value) ? (value as readonly unknown[])[0] : value;
  const numberValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return Math.ceil(numberValue);
}
