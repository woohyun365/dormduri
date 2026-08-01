import { describe, expect, it, vi } from 'vitest';
import { AuthSecurityAlertRepository } from './auth-security-alert.repository.js';

describe('AuthSecurityAlertRepository', () => {
  it('recent security event와 oldest pending mail lag만 bounded signal로 읽는다', async () => {
    const now = new Date('2026-08-01T00:10:00.000Z');
    const prisma = {
      authSecurityEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            type: 'VERIFICATION_CODE_REQUESTED',
            emailHash: 'v2:subject-key',
            createdAt: new Date('2026-08-01T00:09:00.000Z'),
            metadata: { purpose: 'RESET_PASSWORD' },
          },
        ]),
      },
      authMailOutboxEvent: {
        findFirst: vi.fn().mockResolvedValue({
          createdAt: new Date('2026-08-01T00:08:30.000Z'),
        }),
      },
    };
    const repository = new AuthSecurityAlertRepository();

    await expect(
      repository.readSignals(prisma as never, {
        since: new Date('2026-08-01T00:00:00.000Z'),
        now,
      }),
    ).resolves.toEqual({
      events: [
        {
          type: 'VERIFICATION_CODE_REQUESTED',
          subjectKey: 'v2:subject-key',
          createdAt: new Date('2026-08-01T00:09:00.000Z'),
          metadata: { purpose: 'RESET_PASSWORD' },
        },
      ],
      mailOutboxLagSeconds: 90,
    });
  });
});
