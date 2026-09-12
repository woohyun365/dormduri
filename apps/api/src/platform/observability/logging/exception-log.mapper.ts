import type { NormalizedApiError } from '../../http/api-error.js';
import { statusClassFromStatusCode, type AppLogEvent, type AppLogLevel } from './log-event.js';
import { resolveRequestRouteTemplate, type RequestRouteShape } from './request-route.js';

export interface ExceptionLogRequest extends RequestRouteShape {
  method: string;
}

export interface ExceptionLogMapping {
  event: AppLogEvent;
  level: AppLogLevel;
  message: string;
}

export function mapExceptionToLogEvent(
  request: ExceptionLogRequest,
  normalized: NormalizedApiError,
): ExceptionLogMapping {
  const level = resolveExceptionLogLevel(normalized.statusCode);

  return {
    level,
    message: 'http exception handled',
    event: {
      errorCode: normalized.code,
      errorName: normalized.code,
      method: request.method,
      operation: 'http_exception',
      outcome: 'failure',
      route: resolveRequestRouteTemplate(request),
      statusClass: statusClassFromStatusCode(normalized.statusCode),
      statusCode: normalized.statusCode,
    },
  };
}

function resolveExceptionLogLevel(statusCode: number): AppLogLevel {
  if (statusCode >= 500) {
    return 'error';
  }

  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return 'warn';
  }

  return 'info';
}
