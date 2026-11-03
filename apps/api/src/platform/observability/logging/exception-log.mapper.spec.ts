import { describe, expect, it } from 'vitest';
import type { NormalizedApiError } from '../../http/api-error.js';
import { mapExceptionToLogEvent } from './exception-log.mapper.js';
import { recordRequestRouteTemplate } from './request-route.js';

// The route template guard records the template before the filter maps the exception.
function makeRequest() {
  const request = {
    method: 'GET',
    originalUrl: '/api/users/raw-id?email=student@knu.ac.kr',
  };
  recordRequestRouteTemplate(request, '/users/:id');
  return request;
}

function makeNormalized(statusCode: number): NormalizedApiError {
  return {
    code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
    error: '사용자에게 보이는 오류 메시지',
    extras: {
      requestBody: { password: 'secret' },
    },
    stack: 'stack should not be logged by mapper',
    statusCode,
  };
}

describe('exception log mapper', () => {
  it('maps normalized errors to safe route-template log events', () => {
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(400))).toEqual({
      level: 'info',
      message: 'http exception handled',
      event: {
        errorCode: 'BAD_REQUEST',
        errorName: 'BAD_REQUEST',
        method: 'GET',
        operation: 'http_exception',
        outcome: 'failure',
        route: '/users/:id',
        statusClass: '4xx',
        statusCode: 400,
      },
    });
  });

  it('keeps the bounded UNKNOWN_ROUTE label for a request no route matched', () => {
    expect(mapExceptionToLogEvent({ method: 'GET' }, makeNormalized(404)).event.route).toBe(
      'UNKNOWN_ROUTE',
    );
  });

  it('uses warn for auth/rate-limit responses and error for 5xx', () => {
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(401)).level).toBe('warn');
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(403)).level).toBe('warn');
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(429)).level).toBe('warn');
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(500)).level).toBe('error');
  });
});
