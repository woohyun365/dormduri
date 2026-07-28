import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createOverrideDisplayIdentityNicknameCommand } from './override-display-identity-nickname.command.js';
import { usersErrors } from '../errors/users.errors.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');
const USER = {
  id: 'user-1',
  email: 'student@kangwon.ac.kr',
  emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
  deletedAt: null,
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
  displayIdentity: {
    userId: 'user-1',
    nickname: '기존닉네임',
    nicknameNormalized: '기존닉네임',
    nicknameChangedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  },
  academicIdentity: {
    userId: 'user-1',
    collegeCode: 'CHUNCHEON_IT',
    birthYear: 2002,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  },
  dismissedNotices: [],
};

const REGISTERED_PARTICIPANT = {
  id: 'participant-1',
  userId: 'user-1',
  seasonId: 'season-1',
  participationIntent: 'REGISTERED',
  participantStatus: 'ACTIVE',
  registeredAt: NOW,
  declinedAt: null,
  withdrawnAt: null,
  hiddenByAdminAt: null,
  deactivatedAt: null,
  expiredAt: null,
  deletedAt: null,
  deidentifiedAt: null,
  dormitoryId: 'dasan',
  dormitorySelectionState: 'ASSIGNED',
  activatedAt: NOW,
};

type AuditCreateArgs = {
  data: Record<string, unknown>;
  select: { id: true };
};

describe('OverrideDisplayIdentityNicknameCommand', () => {
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn(),
  };
  const moderationService = {
    validateNicknamePolicy: vi.fn(),
  };
  const tx = {
    user: { findUnique: vi.fn() },
    seasonParticipant: { findUnique: vi.fn() },
    seasonParticipantProfile: { updateMany: vi.fn() },
    userDisplayIdentity: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    userDisplayIdentityNicknameChangeEvent: { create: vi.fn() },
  };
  const command = createOverrideDisplayIdentityNicknameCommand({
    prisma: prisma as never,
    seasonsService: seasonsService as never,
    moderationService: moderationService as never,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(NOW);
    prisma.runSerializableTransaction.mockImplementation((callback: (client: unknown) => unknown) =>
      Promise.resolve(callback(tx)),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      state: 'SEASON_OPEN',
      season: { id: 'season-1' },
    });
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(USER);
    tx.userDisplayIdentity.findUnique.mockResolvedValue(null);
    tx.userDisplayIdentity.updateMany.mockResolvedValue({ count: 1 });
    tx.seasonParticipant.findUnique.mockResolvedValue(REGISTERED_PARTICIPANT);
    tx.seasonParticipantProfile.updateMany.mockResolvedValue({ count: 1 });
    tx.userDisplayIdentityNicknameChangeEvent.create.mockResolvedValue({ id: 'event-1' });
  });

  it('mixed-script operations nickname은 DB time·moderation·transaction 전에 거절한다', async () => {
    await expect(
      command.overrideDisplayIdentityNicknameForPolicyEnforcement({
        userId: 'user-1',
        nickname: '안녕hi',
        actorId: 'admin-1',
        reason: 'ADMIN_MANUAL',
      }),
    ).rejects.toMatchObject({
      response: usersErrors.invalidNickname('한글과 영문은 함께 사용할 수 없어요.').getResponse(),
    });

    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('policy enforcement override는 nickname update, registered snapshot, audit append를 같은 tx client로 수행한다', async () => {
    await expect(
      command.overrideDisplayIdentityNicknameForPolicyEnforcement({
        userId: 'user-1',
        nickname: '운영변경',
        actorId: 'admin-1',
        reason: 'REPORT_REVIEW',
        reportId: 'report-1',
        metadata: { source: 'review' },
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      nickname: '운영변경',
      nicknameNormalized: '운영변경',
      nicknameChangedAt: NOW.toISOString(),
      override: {
        actorId: 'admin-1',
        actorType: 'ADMIN',
        reason: 'REPORT_REVIEW',
        appliedAt: NOW.toISOString(),
        auditEventId: 'event-1',
      },
    });

    expect(tx.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', nicknameChangedAt: null },
      data: {
        nickname: '운영변경',
        nicknameNormalized: '운영변경',
        nicknameChangedAt: NOW,
      },
    });
    expect(tx.seasonParticipantProfile.updateMany).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        nicknameSnapshot: '운영변경',
        nicknameNormalizedSnapshot: '운영변경',
      },
    });
    const auditCreateMock = tx.userDisplayIdentityNicknameChangeEvent.create as Mock<
      (arg0: AuditCreateArgs) => unknown
    >;
    const [auditCreateArgs] = auditCreateMock.mock.calls[0]!;
    expect(auditCreateArgs.data).toMatchObject({
      userId: 'user-1',
      source: 'POLICY_ENFORCEMENT',
      reason: 'REPORT_REVIEW',
      actorType: 'ADMIN',
      actorId: 'admin-1',
      previousNickname: '기존닉네임',
      nextNickname: '운영변경',
      seasonId: 'season-1',
      participantId: 'participant-1',
      seasonProfileSnapshotUpdated: true,
      reportId: 'report-1',
      metadata: { source: 'review' },
      changedAt: NOW,
    });
  });

  it('moderation에서 거부된 operations nickname은 tx 없이 기존 error를 유지한다', async () => {
    moderationService.validateNicknamePolicy.mockResolvedValue('사용할 수 없는 단어입니다.');

    await expect(
      command.overrideDisplayIdentityNicknameForPolicyEnforcement({
        userId: 'user-1',
        nickname: '금칙어',
        actorId: 'admin-1',
        reason: 'ADMIN_MANUAL',
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameModerationRejected('사용할 수 없는 단어입니다.').getResponse(),
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });
});
