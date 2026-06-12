import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { recordDisplayIdentityNicknameChangeAuditTx } from './display-identity-nickname-audit.repository.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');

type AuditCreateArgs = { data: Record<string, unknown>; select: { id: true } };
describe('display identity nickname audit repository', () => {
  const client = {
    userDisplayIdentityNicknameChangeEvent: {
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client.userDisplayIdentityNicknameChangeEvent.create.mockResolvedValue({ id: 'event-1' });
  });

  it('audit append는 민감 reference 기본값을 null/false로 보존하고 event id만 select한다', async () => {
    await recordDisplayIdentityNicknameChangeAuditTx(client as never, {
      userId: 'user-1',
      source: 'USER_SELF',
      reason: 'USER_REQUEST',
      actorType: 'USER',
      actorId: 'user-1',
      previousNickname: '기존닉네임',
      previousNicknameNormalized: '기존닉네임',
      nextNickname: '새닉네임',
      nextNicknameNormalized: '새닉네임',
      changedAt: NOW,
    });

    const createMock = client.userDisplayIdentityNicknameChangeEvent.create as Mock<
      (arg0: AuditCreateArgs) => unknown
    >;
    const [createArgs] = createMock.mock.calls[0]!;
    expect(createArgs.select).toEqual({ id: true });
    expect(createArgs.data).toMatchObject({
      userId: 'user-1',
      retainedIdentityId: null,
      source: 'USER_SELF',
      reason: 'USER_REQUEST',
      actorType: 'USER',
      actorId: 'user-1',
      previousNickname: '기존닉네임',
      nextNickname: '새닉네임',
      seasonId: null,
      participantId: null,
      seasonProfileSnapshotUpdated: false,
      reportId: null,
      moderationCaseId: null,
      sanctionId: null,
      approvalReference: null,
      changedAt: NOW,
    });
  });
});
