import { AuthSecurityEventService } from './auth-security-event.service.js';

interface AuthSecurityEventCreateArgs {
  data: {
    type: string;
    severity: string;
    actorUserId?: string;
    targetUserId?: string;
    sessionId?: string;
    emailHash?: string;
    requestIpHash?: string;
    userAgentHash?: string;
    metadata?: Record<string, unknown>;
  };
}

describe('AuthSecurityEventService', () => {
  const prisma = {
    authSecurityEvent: {
      create: jest.fn<Promise<void>, [AuthSecurityEventCreateArgs]>().mockResolvedValue(undefined),
    },
  };
  const service = new AuthSecurityEventService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
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

    const createCall = prisma.authSecurityEvent.create.mock.calls[0]?.[0];
    if (!createCall) {
      throw new Error('Expected authSecurityEvent.create call');
    }
    expect(createCall.data).toMatchObject({
      type: 'LOGIN_FAILURE',
      severity: 'WARNING',
      metadata: {
        reason: 'invalid_credentials',
      },
    });
    expect(createCall.data.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall.data.requestIpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall.data.userAgentHash).toMatch(/^[a-f0-9]{64}$/);

    const serialized = JSON.stringify(createCall.data);
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

    const createCall = prisma.authSecurityEvent.create.mock.calls[0]?.[0];
    if (!createCall) {
      throw new Error('Expected authSecurityEvent.create call');
    }

    expect(createCall.data.type).toBe('MAIL_SEND_FAILURE');
    expect(createCall.data.severity).toBe('WARNING');
    expect(createCall.data.actorUserId).toBe('user-1');
    expect(createCall.data.targetUserId).toBe('user-2');
    expect(createCall.data.sessionId).toBe('session-1');
    expect(createCall.data.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall.data.metadata).toEqual({
      purpose: 'RESET_PASSWORD',
      metricName: 'auth.mail.send.failure',
      providerErrorCategory: 'throttled',
    });
  });
});
