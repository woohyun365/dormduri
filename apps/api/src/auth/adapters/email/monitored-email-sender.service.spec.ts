import { MonitoredEmailSenderService } from './monitored-email-sender.service.js';
import type { AuthSecurityEventInput } from '../../security-events/auth-security-event.types.js';

describe('MonitoredEmailSenderService', () => {
  const delegate = {
    sendVerificationCode: jest.fn(),
    sendPasswordResetCode: jest.fn(),
  };
  const securityEvents = {
    record: jest.fn<Promise<void>, [AuthSecurityEventInput]>().mockResolvedValue(undefined),
  };
  const service = new MonitoredEmailSenderService(delegate as never, securityEvents as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signup mail success를 code 없이 security event/metric으로 남긴다', async () => {
    delegate.sendVerificationCode.mockResolvedValue(undefined);

    await service.sendVerificationCode({
      email: 'student@kangwon.ac.kr',
      code: '123456',
      expiresInSeconds: 600,
    });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MAIL_SEND_SUCCESS',
        severity: 'INFO',
        emailNormalized: 'student@kangwon.ac.kr',
        metadata: {
          purpose: 'SIGNUP',
          metricName: 'auth.mail.send.success',
          ttlSeconds: 600,
        },
      }),
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('123456');
  });

  it('reset mail failure를 provider category와 함께 기록하고 원래 error는 유지한다', async () => {
    delegate.sendPasswordResetCode.mockRejectedValue(new Error('SES throttled: raw provider text'));

    await expect(
      service.sendPasswordResetCode({
        email: 'student@kangwon.ac.kr',
        code: '654321',
        expiresInSeconds: 900,
      }),
    ).rejects.toThrow('SES throttled');

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MAIL_SEND_FAILURE',
        severity: 'WARNING',
        emailNormalized: 'student@kangwon.ac.kr',
        metadata: {
          purpose: 'RESET_PASSWORD',
          metricName: 'auth.mail.send.failure',
          providerErrorCategory: 'Error',
          ttlSeconds: 900,
        },
      }),
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('654321');
  });
});
