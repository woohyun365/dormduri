import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import type { NormalizedApiError } from '../../http/api-error.js';
import { mapExceptionToLogEvent } from './exception-log.mapper.js';

function makeRequest(): Request {
  return {
    method: 'GET',
    originalUrl: '/api/users/raw-id?email=student@knu.ac.kr',
    route: { path: '/users/:id' },
  } as unknown as Request;
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

  it('uses warn for auth/rate-limit responses and error for 5xx', () => {
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(401)).level).toBe('warn');
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(403)).level).toBe('warn');
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(429)).level).toBe('warn');
    expect(mapExceptionToLogEvent(makeRequest(), makeNormalized(500)).level).toBe('error');
  });
});
