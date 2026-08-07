import { describe, expect, it } from 'vitest';
import {
  createOperationalEventEnvelope,
  resolveOperationalRouteGroup,
} from '../operational-context';
import { sanitizeOperationalEvent } from '../sanitize-operational-event';

function validRuntimeEvent() {
  return {
    ...createOperationalEventEnvelope({
      pathname: '/signup?email=student@example.com',
      viewportWidth: 390,
      environment: 'preview',
      release: 'test-release',
      occurredAt: '2026-08-06T00:00:00.000Z',
    }),
    eventName: 'web_runtime_error' as const,
    source: 'window_error' as const,
    severity: 'error' as const,
    errorType: 'TypeError',
    fingerprint: 'err_12345678',
    digestPresent: false,
    handled: false,
    recoveryAction: 'none' as const,
    recoveryOutcome: 'unknown' as const,
  };
}

describe('operational event privacy contract', () => {
  it('raw query와 path identifier 대신 bounded route group을 사용한다', () => {
    expect(resolveOperationalRouteGroup('/signup?email=student@example.com')).toBe('signup');
    expect(resolveOperationalRouteGroup('/main/matching/requests/request-123')).toBe(
      'main_matching',
    );
    expect(resolveOperationalRouteGroup('/unknown/user-123')).toBe('other');
  });

  it('allowlisted runtime event만 통과시킨다', () => {
    expect(sanitizeOperationalEvent(validRuntimeEvent())).toEqual(validRuntimeEvent());
    expect(
      sanitizeOperationalEvent({ ...validRuntimeEvent(), eventName: 'unknown_event' }),
    ).toBeNull();
  });

  it.each([
    ['email', 'student@example.com'],
    ['password', 'secret'],
    ['verificationCode', '123456'],
    ['authorization', 'Bearer token'],
    ['cookie', 'access=value'],
    ['requestBody', { intro: 'raw copy' }],
    ['profile', { nickname: '감자친구' }],
    ['userId', 'user-1'],
  ])('forbidden key %s가 추가되면 event를 거부한다', (key, value) => {
    expect(sanitizeOperationalEvent({ ...validRuntimeEvent(), [key]: value })).toBeNull();
  });

  it('requestId는 server structured log에서만 허용한다', () => {
    const event = {
      ...createOperationalEventEnvelope({ occurredAt: '2026-08-06T00:00:00.000Z' }),
      eventName: 'web_bff_request_completed',
      operation: 'auth.login',
      method: 'POST',
      outcome: 'success',
      statusClass: '2xx',
      durationMs: 12,
      authenticated: false,
      requestCorrelationPresent: true,
      requestId: 'request-1',
    };
    expect(sanitizeOperationalEvent(event)).toBeNull();
    expect(sanitizeOperationalEvent(event, { allowLogCorrelationFields: true })).toEqual(event);
  });
});
