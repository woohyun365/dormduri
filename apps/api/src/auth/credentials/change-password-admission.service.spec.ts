import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordAdmissionService } from './change-password-admission.service.js';

const settings = {
  authChangePasswordLimit: 10,
  authChangePasswordWindowSeconds: 600,
  persistenceHmacSecret: 'test-auth-persistence-secret',
};

describe('ChangePasswordAdmissionService', () => {
  it('actor/session별 10회/10분 budget을 원문 식별자 없는 key로 소비한다', async () => {
    const storage = makeStorage(false);
    const flowMetrics = { recordSensitiveMutation: vi.fn() };
    const service = new ChangePasswordAdmissionService(
      storage,
      settings as never,
      flowMetrics as never,
    );

    await expect(service.consume('user-1', 'session-1')).resolves.toBeNull();

    expect(storage.increment).toHaveBeenCalledWith(
      expect.not.stringMatching(/user-1|session-1/),
      600_000,
      10,
      600_000,
      'change-password-session',
    );
    expect(flowMetrics.recordSensitiveMutation).toHaveBeenCalledWith('change_password', 'allowed');
  });

  it('같은 NAT를 공유해도 서로 다른 actor/session은 primary budget key를 공유하지 않는다', async () => {
    const storage = makeStorage(false);
    const service = new ChangePasswordAdmissionService(
      storage,
      settings as never,
      { recordSensitiveMutation: vi.fn() } as never,
    );

    await service.consume('user-1', 'session-1');
    await service.consume('user-2', 'session-2');

    const firstKey = storage.increment.mock.calls[0]?.[0];
    const secondKey = storage.increment.mock.calls[1]?.[0];
    expect(firstKey).not.toBe(secondKey);
  });

  it('차단 시 login account lock을 변경하지 않고 Retry-After만 반환한다', async () => {
    const storage = makeStorage(true);
    const flowMetrics = { recordSensitiveMutation: vi.fn() };
    const service = new ChangePasswordAdmissionService(
      storage,
      settings as never,
      flowMetrics as never,
    );

    await expect(service.consume('user-1', 'session-1')).resolves.toBe(587);
    expect(flowMetrics.recordSensitiveMutation).toHaveBeenCalledWith(
      'change_password',
      'throttled',
    );
  });
});

function makeStorage(isBlocked: boolean) {
  return {
    increment: vi
      .fn<
        (
          key: string,
          ttl: number,
          limit: number,
          blockDuration: number,
          throttlerName: string,
        ) => Promise<{
          totalHits: number;
          timeToExpire: number;
          isBlocked: boolean;
          timeToBlockExpire: number;
        }>
      >()
      .mockResolvedValue({
        totalHits: isBlocked ? 11 : 1,
        timeToExpire: 600,
        isBlocked,
        timeToBlockExpire: isBlocked ? 587 : 0,
      }),
  };
}
