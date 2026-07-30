import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { AuthSecurityEventService } from './auth-security-event.service.js';

interface AuthSecurityEventCreateData {
  type: string;
  severity: string;
  actorUserId?: string;
  targetUserId?: string;
  sessionId?: string;
  emailHash?: string;
  requestIpHash?: string;
  userAgentHash?: string;
  metadata?: Record<string, unknown>;
}

describe('AuthSecurityEventService', () => {
  const repository = {
    create: vi
      .fn<(arg0: AuthSecurityEventCreateData) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const service = new AuthSecurityEventService(
    repository as never,
    {
      persistenceHmacSecret: 'test-auth-persistence-hmac-secret',
    } as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('raw email/IP/UA와 민감값 없이 hash dimension과 safe metadata만 저장한다', async () => {
    await service.record({
      type: 'LOGIN_FAILURE',
      severity: 'WARNING',
      emailNormalized: ' Student@Kangwon.ac.kr ',
      requestIp: ' 127.0.0.1 ',
      userAgent: 'Mozilla/5.0 phase6-test-agent',
      metadata: {
        reason: 'invalid_credentials',
        password: 'PlainPassword1234!',
        token: 'v1.session.raw-secret-token',
        code: '123456',
      },
    });

    const createCall = repository.create.mock.calls[0]?.[0];
    if (!createCall) {
      throw new Error('Expected authSecurityEvent.create call');
    }
    expect(createCall).toMatchObject({
      type: 'LOGIN_FAILURE',
      severity: 'WARNING',
      metadata: {
        reason: 'invalid_credentials',
      },
    });
    expect(createCall.emailHash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(createCall.requestIpHash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(createCall.userAgentHash).toMatch(/^v1:[a-f0-9]{64}$/);

    const serialized = JSON.stringify(createCall);
    expect(serialized).not.toContain('Student@Kangwon.ac.kr');
    expect(serialized).not.toContain('127.0.0.1');
    expect(serialized).not.toContain('phase6-test-agent');
    expect(serialized).not.toContain('PlainPassword1234!');
    expect(serialized).not.toContain('raw-secret-token');
    expect(serialized).not.toContain('123456');
  });

  it('login/reset/mail spike alert 판단에 필요한 event type과 retention index dimension을 보존한다', async () => {
    await service.record({
      type: 'MAIL_SEND_FAILURE',
      severity: 'WARNING',
      actorUserId: 'user-1',
      targetUserId: 'user-2',
      sessionId: 'session-1',
      emailNormalized: 'student@kangwon.ac.kr',
      metadata: {
        purpose: 'RESET_PASSWORD',
        metricName: 'auth.mail.send.failure',
        providerErrorCategory: 'throttled',
      },
    });

    const createCall = repository.create.mock.calls[0]?.[0];
    if (!createCall) {
      throw new Error('Expected authSecurityEvent.create call');
    }

    expect(createCall.type).toBe('MAIL_SEND_FAILURE');
    expect(createCall.severity).toBe('WARNING');
    expect(createCall.actorUserId).toBe('user-1');
    expect(createCall.targetUserId).toBe('user-2');
    expect(createCall.sessionId).toBe('session-1');
    expect(createCall.emailHash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(createCall.metadata).toEqual({
      purpose: 'RESET_PASSWORD',
      metricName: 'auth.mail.send.failure',
      providerErrorCategory: 'throttled',
    });
  });

  it('safe record 실패는 auth user flow를 막지 않는다', async () => {
    repository.create.mockRejectedValueOnce(new Error('temporary audit store outage'));
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      service.recordSafely({
        type: 'LOGIN_FAILURE',
        emailNormalized: 'student@kangwon.ac.kr',
        metadata: { reason: 'invalid_credentials' },
      }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to record event type=LOGIN_FAILURE'),
    );
    warnSpy.mockRestore();
  });
});
