import { createUpdateAcademicIdentityCommand } from './update-academic-identity.command.js';
import { usersErrors } from '../../users.errors.js';

const NOW = new Date('2026-05-23T00:00:00.000Z');
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
    collegeCode: 'ARTS_ENGINEERING',
    birthYear: 2002,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  },
  dismissedNotices: [],
};

function makeRegisteredParticipant() {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-05-20T00:00:00.000Z'),
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-05-01T00:00:00.000Z'),
    activatedAt: new Date('2026-05-20T00:00:00.000Z'),
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    profile: null,
  };
}

type AcademicAuditCreateArgs = {
  data: Record<string, unknown>;
  select: { id: true };
};

describe('UpdateAcademicIdentityCommand', () => {
  const prisma = {};
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const command = createUpdateAcademicIdentityCommand({
    prisma: prisma as never,
    seasonsService: seasonsService as never,
  });
  const tx = {
    seasonParticipant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    seasonParticipantProfileHistory: {
      findFirst: jest.fn(),
    },
    userAcademicIdentity: {
      upsert: jest.fn(),
    },
    userAcademicIdentityChangeAllowance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    userAcademicIdentityChangeEvent: {
      create: jest.fn(),
    },
    season: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    tx.seasonParticipant.findUnique.mockResolvedValue(null);
    tx.seasonParticipant.findMany.mockResolvedValue([]);
    tx.seasonParticipantProfileHistory.findFirst.mockResolvedValue(null);
    tx.userAcademicIdentity.upsert.mockResolvedValue({ userId: 'user-1' });
    tx.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      academicYear: 2026,
      collegeChangeRemaining: 1,
    });
    tx.userAcademicIdentityChangeAllowance.updateMany.mockResolvedValue({ count: 1 });
    tx.userAcademicIdentityChangeEvent.create.mockResolvedValue({ id: 'event-1' });
    tx.season.findFirst.mockResolvedValue({ academicYear: 2026 });
  });

  it('same academic identity no-op은 registration lock/allowance/audit보다 먼저 idempotent하게 반환한다', async () => {
    const result = await command.applyAcademicIdentityChange(
      USER,
      command.parseAcademicIdentity({ collegeCode: 'ARTS_ENGINEERING', birthYear: 2002 }),
      NOW,
      tx as never,
    );

    expect(result).toEqual({
      attempted: true,
      changed: false,
      noOpReason: 'SAME_ACADEMIC_IDENTITY',
    });
    expect(seasonsService.getCurrentSeasonContext).not.toHaveBeenCalled();
    expect(tx.userAcademicIdentityChangeAllowance.updateMany).not.toHaveBeenCalled();
    expect(tx.userAcademicIdentityChangeEvent.create).not.toHaveBeenCalled();
  });

  it('current registered participant lock은 기존 academic identity error behavior를 유지한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1', academicYear: 2026 },
      state: 'SEASON_OPEN',
    });
    tx.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      command.applyAcademicIdentityChange(
        USER,
        command.parseAcademicIdentity({ collegeCode: 'BUSINESS', birthYear: 2002 }),
        NOW,
        tx as never,
      ),
    ).rejects.toMatchObject({
      response: usersErrors.academicIdentityLockedByRegistration().getResponse(),
    });

    expect(tx.userAcademicIdentityChangeAllowance.updateMany).not.toHaveBeenCalled();
    expect(tx.userAcademicIdentity.upsert).not.toHaveBeenCalled();
  });

  it('birthYear self correction은 update와 audit append를 같은 tx client에 수행한다', async () => {
    await expect(
      command.applyAcademicIdentityChange(
        USER,
        command.parseAcademicIdentity({ collegeCode: 'ARTS_ENGINEERING', birthYear: 2001 }),
        NOW,
        tx as never,
      ),
    ).resolves.toEqual({ attempted: true, changed: true, noOpReason: null });

    expect(tx.userAcademicIdentity.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        collegeCode: 'ARTS_ENGINEERING',
        birthYear: 2001,
      },
      update: {
        collegeCode: 'ARTS_ENGINEERING',
        birthYear: 2001,
      },
    });
    const auditCreateMock = tx.userAcademicIdentityChangeEvent.create as jest.Mock<
      unknown,
      [AcademicAuditCreateArgs]
    >;
    const [auditCreateArgs] = auditCreateMock.mock.calls[0]!;
    expect(auditCreateArgs.data).toMatchObject({
      userId: 'user-1',
      source: 'USER_SELF',
      reason: 'USER_CORRECTION',
      actorType: 'USER',
      actorId: 'user-1',
      previousCollegeCode: 'ARTS_ENGINEERING',
      nextCollegeCode: 'ARTS_ENGINEERING',
      previousBirthYear: 2002,
      nextBirthYear: 2001,
      changedAt: NOW,
    });
    expect(auditCreateArgs.select).toEqual({ id: true });
  });
});
