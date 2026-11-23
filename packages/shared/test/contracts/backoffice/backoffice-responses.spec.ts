import { describe, expect, it } from 'vitest';
import {
  accessRequestListResponseSchema,
  auditEventListResponseSchema,
  backofficeErrorResponseSchema,
  issuedSessionResponseSchema,
  registrationResponseSchema,
  sessionInfoResponseSchema,
} from '@repo/shared/backoffice';

const ACCOUNT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const REQUEST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('backoffice response contract', () => {
  it('session issue keeps the token for the BFF and the scope for the screen', () => {
    const body = {
      session: {
        token: 'A'.repeat(43),
        scope: 'RECOVERY',
        absoluteExpiresAt: '2026-11-22T12:00:00.000Z',
      },
    };
    expect(issuedSessionResponseSchema.parse(body)).toEqual(body);
    expect(
      issuedSessionResponseSchema.safeParse({ session: { ...body.session, scope: 'ADMIN' } })
        .success,
    ).toBe(false);
  });

  it('registration returns the TOTP secret and ten recovery codes once', () => {
    const body = {
      session: {
        token: 'B'.repeat(43),
        scope: 'FULL',
        absoluteExpiresAt: '2026-11-22T12:00:00.000Z',
      },
      accountId: ACCOUNT_ID,
      totp: {
        secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/dormduri%20backoffice:owner?secret=JBSWY3DPEHPK3PXP',
      },
      recoveryCodes: Array.from({ length: 10 }, () => 'ABCDE-FGH23'),
    };
    expect(registrationResponseSchema.parse(body).recoveryCodes).toHaveLength(10);
    expect(
      registrationResponseSchema.safeParse({ ...body, totp: { ...body.totp, uri: 'https://x' } })
        .success,
    ).toBe(false);
  });

  it('session info lists only contract permissions', () => {
    const body = {
      account: { id: ACCOUNT_ID, email: 'owner@backoffice.test', displayName: 'Owner' },
      scope: 'FULL',
      roles: ['OWNER'],
      permissions: ['admin:access:approve', 'admin:audit:read'],
      idleExpiresAt: '2026-11-22T04:15:00.000Z',
      absoluteExpiresAt: '2026-11-22T12:00:00.000Z',
      reauthenticatedUntil: null,
      totpConfirmed: true,
      recoveryCodesRemaining: 10,
      passkeyCount: 1,
    };
    expect(sessionInfoResponseSchema.parse(body).permissions).toEqual(body.permissions);
    expect(
      sessionInfoResponseSchema.safeParse({ ...body, permissions: ['admin:restricted:read'] })
        .success,
    ).toBe(false);
  });

  it('access request list carries the keyset cursor of the next page', () => {
    const request = {
      id: REQUEST_ID,
      kind: 'ROLE_GRANT',
      status: 'PENDING',
      contentDigest: 'a'.repeat(64),
      targetAccountId: ACCOUNT_ID,
      targetRole: 'AUDITOR',
      requestedByAccountId: ACCOUNT_ID,
      requestReason: null,
      expiresAt: '2026-11-29T04:00:00.000Z',
      decidedByAccountId: null,
      closedAt: null,
      decisionReason: null,
      selfApproved: false,
      createdAt: '2026-11-22T04:00:00.000Z',
    };
    const page = accessRequestListResponseSchema.parse({
      requests: [request],
      nextPage: { beforeTime: request.createdAt, beforeId: request.id },
    });
    expect(page.nextPage).toEqual({ beforeTime: request.createdAt, beforeId: request.id });
  });

  it('audit rows of the system actor carry no access path or session', () => {
    const page = auditEventListResponseSchema.parse({
      events: [
        {
          id: REQUEST_ID,
          occurredAt: '2026-11-22T04:00:00.000Z',
          actorType: 'SYSTEM',
          actorAccountId: null,
          sessionId: null,
          accessPath: null,
          action: 'BOOTSTRAP_OWNER',
          targetType: 'ADMIN_INVITATION',
          targetId: ACCOUNT_ID,
          approvalRequestId: null,
          result: 'SUCCEEDED',
          selfApproved: false,
          reason: null,
          requestId: null,
          metadata: { expiresInMinutes: 15 },
        },
      ],
      nextPage: null,
    });
    expect(page.events[0]?.accessPath).toBeNull();
  });

  it('error body is a known code', () => {
    expect(
      backofficeErrorResponseSchema.parse({ error: { code: 'session_expired', requestId: 'r-1' } })
        .error.code,
    ).toBe('session_expired');
    expect(backofficeErrorResponseSchema.safeParse({ error: { code: 'teapot' } }).success).toBe(
      false,
    );
  });
});
