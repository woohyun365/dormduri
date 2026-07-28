import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createUpdateDisplayIdentityCommand } from './update-display-identity.command.js';
import { usersErrors } from '../../errors/users.errors.js';

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

type AuditCreateArgs = {
  data: Record<string, unknown>;
  select: { id: true };
};

describe('UpdateDisplayIdentityCommand', () => {
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
  const command = createUpdateDisplayIdentityCommand({
    prisma: prisma as never,
    seasonsService: seasonsService as never,
    moderationService: moderationService as never,
  });
  const tx = {
    seasonParticipant: { findUnique: vi.fn() },
    userDisplayIdentity: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    userDisplayIdentityNicknameChangeEvent: { create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    tx.userDisplayIdentity.findUnique.mockResolvedValue(null);
    tx.userDisplayIdentity.updateMany.mockResolvedValue({ count: 1 });
    tx.userDisplayIdentityNicknameChangeEvent.create.mockResolvedValue({ id: 'event-1' });
  });

  it('mixed-script nickname은 moderation 호출 전에 shared 구조 오류로 거절한다', () => {
    expect(() => command.parseDisplayIdentityNickname('안녕hi')).toThrow();
    try {
      command.parseDisplayIdentityNickname('안녕hi');
    } catch (error) {
      expect(error).toMatchObject({
        response: usersErrors.invalidNickname('한글과 영문은 함께 사용할 수 없어요.').getResponse(),
      });
    }
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
  });

  it('NFKC canonical value와 lowercase key를 같은 parsed result로 반환한다', () => {
    expect(command.parseDisplayIdentityNickname('  ＮiceＧuy  ')).toEqual({
      ok: true,
      value: 'NiceGuy',
      normalized: 'niceguy',
      script: 'LATIN',
    });
  });

  it('same nickname no-op은 lock/cooldown/moderation보다 먼저 idempotent하게 반환한다', async () => {
    const result = await command.applySelfServiceNicknameChange(
      {
        ...USER,
        displayIdentity: {
          ...USER.displayIdentity,
          nicknameChangedAt: new Date('2026-05-20T23:59:00.000Z'),
        },
      },
      command.parseDisplayIdentityNickname('기존닉네임'),
      NOW,
      tx as never,
    );

    expect(result).toEqual({ attempted: true, changed: false, noOpReason: 'SAME_NICKNAME' });
    expect(seasonsService.getCurrentSeasonContext).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
    expect(tx.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(tx.userDisplayIdentityNicknameChangeEvent.create).not.toHaveBeenCalled();
  });

  it('moderation에서 거부된 nickname은 update/audit 없이 기존 error를 유지한다', async () => {
    moderationService.validateNicknamePolicy.mockResolvedValue(
      '사용할 수 없는 닉네임이에요. 다른 닉네임을 입력해 주세요.',
    );

    await expect(
      command.applySelfServiceNicknameChange(
        USER,
        command.parseDisplayIdentityNickname('탈퇴한사용자'),
        NOW,
        tx as never,
      ),
    ).rejects.toMatchObject({
      response: usersErrors
        .nicknameModerationRejected('사용할 수 없는 닉네임이에요. 다른 닉네임을 입력해 주세요.')
        .getResponse(),
    });

    expect(tx.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(tx.userDisplayIdentityNicknameChangeEvent.create).not.toHaveBeenCalled();
  });

  it('self-service nickname 변경은 update와 audit append를 같은 tx client에 수행한다', async () => {
    await expect(
      command.applySelfServiceNicknameChange(
        USER,
        command.parseDisplayIdentityNickname('새닉네임'),
        NOW,
        tx as never,
      ),
    ).resolves.toEqual({ attempted: true, changed: true, noOpReason: null });

    expect(tx.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', nicknameChangedAt: null },
      data: {
        nickname: '새닉네임',
        nicknameNormalized: '새닉네임',
        nicknameChangedAt: NOW,
      },
    });
    const auditCreateMock = tx.userDisplayIdentityNicknameChangeEvent.create as Mock<
      (arg0: AuditCreateArgs) => unknown
    >;
    const [auditCreateArgs] = auditCreateMock.mock.calls[0]!;
    expect(auditCreateArgs.data).toMatchObject({
      userId: 'user-1',
      source: 'USER_SELF',
      reason: 'USER_REQUEST',
      actorType: 'USER',
      actorId: 'user-1',
      previousNickname: '기존닉네임',
      nextNickname: '새닉네임',
      changedAt: NOW,
    });
    expect(auditCreateArgs.select).toEqual({ id: true });
  });
});
