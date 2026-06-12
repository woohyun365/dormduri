import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { listDisplayIdentityNicknameChangeAuditForOperations } from './list-display-identity-nickname-audit.query.js';

type AuditFindManyArgs = {
  where: { userId: string };
  select: Record<string, true>;
  orderBy: Array<Record<string, 'desc'>>;
};

describe('ListDisplayIdentityNicknameAuditQuery', () => {
  const client = {
    userDisplayIdentityNicknameChangeEvent: {
      findMany: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client.userDisplayIdentityNicknameChangeEvent.findMany.mockResolvedValue([]);
  });

  it('operations audit list는 userId 기준 최신순 ordering과 allowlisted select를 고정한다', async () => {
    await listDisplayIdentityNicknameChangeAuditForOperations(client as never, 'user-1');

    const findManyMock = client.userDisplayIdentityNicknameChangeEvent.findMany as Mock<
      (arg0: AuditFindManyArgs) => unknown
    >;
    const [findManyArgs] = findManyMock.mock.calls[0]!;
    expect(findManyArgs.where).toEqual({ userId: 'user-1' });
    expect(findManyArgs.select).toHaveProperty('previousNickname');
    expect(findManyArgs.select).toHaveProperty('nextNickname');
    expect(findManyArgs.select).toHaveProperty('reportId');
    expect(findManyArgs.orderBy).toEqual([
      { changedAt: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });
});
