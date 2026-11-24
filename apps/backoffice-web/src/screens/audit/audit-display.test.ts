import type { AuditEvent } from '@repo/shared/backoffice';
import { describe, expect, it } from 'vitest';
import { recoveryLoginMethod } from './audit-display';

// The audit list reads only `scope` and `method` of a LOGIN row's metadata (design plan D-OD10 2); the
// API writes `{ scope, method }` when a login opens a session (admin-login.service.ts).
function event(action: string, metadata: unknown): AuditEvent {
  return {
    id: '00000000-0000-4000-8000-000000000301',
    occurredAt: '2026-11-24T09:40:00+09:00',
    actorType: 'ADMIN',
    actorAccountId: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000401',
    accessPath: 'SSM_PORT_FORWARD',
    action,
    targetType: 'ADMIN_SESSION',
    targetId: '00000000-0000-4000-8000-000000000401',
    approvalRequestId: null,
    result: 'SUCCEEDED',
    selfApproved: false,
    reason: null,
    requestId: null,
    metadata,
  };
}

describe('recoveryLoginMethod', () => {
  it('reads a TOTP or recovery-code recovery login from the LOGIN metadata', () => {
    expect(recoveryLoginMethod(event('LOGIN', { scope: 'RECOVERY', method: 'totp' }))).toBe('totp');
    expect(
      recoveryLoginMethod(event('LOGIN', { scope: 'RECOVERY', method: 'recovery_code' })),
    ).toBe('recovery_code');
  });

  it('shows nothing extra for an unknown metadata shape', () => {
    for (const metadata of [
      null,
      'RECOVERY',
      { scope: 'FULL', method: 'passkey' },
      { scope: 'RECOVERY' },
      { scope: 'RECOVERY', method: 'sms' },
    ]) {
      expect(recoveryLoginMethod(event('LOGIN', metadata))).toBeNull();
    }
    expect(recoveryLoginMethod(event('LOGOUT', { scope: 'RECOVERY', method: 'totp' }))).toBeNull();
  });
});
