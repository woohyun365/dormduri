import type { LifestyleData } from '@repo/shared/lifestyle';
import { ProfilesService } from './profiles.service.js';
import { profilesErrors } from './profiles.errors.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../season-participants/season-participants.service.js';
import { toCompleteLifestyleColumnData } from '../common/lifestyle/lifestyle.persistence.js';

const COMPLETE_LIFESTYLE: LifestyleData = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
};

function makeParticipant(
  overrides: Partial<CurrentSeasonParticipantRecord> = {},
): CurrentSeasonParticipantRecord {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-01-05T00:00:00.000Z'),
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: new Date('2026-01-05T00:00:00.000Z'),
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    profile: {
      participantId: 'participant-1',
      nicknameSnapshot: '시즌닉네임',
      nicknameNormalizedSnapshot: '시즌닉네임',
      lifestyle: COMPLETE_LIFESTYLE,
      intro: '시즌 소개',
      collegeCode: 'ARTS_ENGINEERING',
      grade: '3',
      mbti: 'INTJ',
      birthYear: 2002,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    ...overrides,
  };
}

function toRawParticipant(participant: CurrentSeasonParticipantRecord, userId: string) {
  const { profile, ...participantColumns } = participant;

  return {
    ...participantColumns,
    userId,
    user: {
      id: userId,
      deletedAt: null,
    },
    profile: profile
      ? {
          participantId: profile.participantId,
          nicknameSnapshot: profile.nicknameSnapshot,
          nicknameNormalizedSnapshot: profile.nicknameNormalizedSnapshot,
          ...toCompleteLifestyleColumnData(profile.lifestyle),
          intro: profile.intro,
          collegeCode: profile.collegeCode,
          grade: profile.grade,
          mbti: profile.mbti,
          birthYear: profile.birthYear,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        }
      : null,
  };
}

const seasonContext = {
  season: { id: 'season-1' },
  state: 'SEASON_MATCHING',
  operatedDormitories: [
    { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
  ],
  schedule: {
    preparationStart: '2026-01-01',
    matchingStart: '2026-01-28',
    matchingEnd: '2026-02-11',
    seasonEnd: '2026-02-28',
  },
} as const;

describe('ProfilesService Step 6 public detail', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    campusMaster: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    seasonParticipant: {
      findFirst: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    findRegistrationSnapshotParticipantIdSet: jest.fn(),
  };
  const matchesService = {
    getLiveActiveMatchMapForParticipantIds: jest.fn(),
  };
  const service = new ProfilesService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    matchesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      deletedAt: null,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue(seasonContext);
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
      ) => ({
        dormitoryId: participant?.dormitoryId ?? null,
        dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
        source: 'SEASON_PARTICIPANT',
      }),
    );
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(makeParticipant());
    seasonParticipantsService.findRegistrationSnapshotParticipantIdSet.mockResolvedValue(
      new Set(['participant-target']),
    );
    matchesService.getLiveActiveMatchMapForParticipantIds.mockResolvedValue(new Map());
  });

  it('같은 건물 registration complete target만 detail/score/action capability를 가진다', async () => {
    const target = makeParticipant({
      id: 'participant-target',
      userId: 'peer-1',
      profile: {
        ...makeParticipant().profile!,
        participantId: 'participant-target',
        nicknameSnapshot: '시즌상대',
        nicknameNormalizedSnapshot: '시즌상대',
        intro: '상대 소개',
      },
    });
    prisma.seasonParticipant.findFirst.mockResolvedValue(toRawParticipant(target, 'peer-1'));

    const result = await service.getProfileByUserId(
      { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
      'peer-1',
    );

    expect(result).toMatchObject({
      id: 'peer-1',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relationToViewer: 'GENERAL',
      capabilities: {
        summaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
        actions: {
          canBookmark: true,
          canRequestMatch: true,
          canStartChat: true,
        },
      },
      nickname: '시즌상대',
      intro: '상대 소개',
    });
    expect(result).toHaveProperty('matchScore');
    expect(result.lifestyle).not.toHaveProperty('drinkingFrequency');
    expect(result.lifestyle).not.toHaveProperty('drinkingTolerance');
  });

  it('미등록 viewer는 summary 가능 target이어도 detail API를 열 수 없다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        profile: null,
      }),
    );
    prisma.seasonParticipant.findFirst.mockResolvedValue(
      toRawParticipant(makeParticipant({ id: 'participant-target', userId: 'peer-1' }), 'peer-1'),
    );

    await expect(
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1'),
    ).rejects.toMatchObject({
      response: profilesErrors.profileNotVisible().getResponse(),
    });
  });

  it('registration snapshot이 없는 target은 detail 대상이 아니다', async () => {
    prisma.seasonParticipant.findFirst.mockResolvedValue(
      toRawParticipant(makeParticipant({ id: 'participant-target', userId: 'peer-1' }), 'peer-1'),
    );
    seasonParticipantsService.findRegistrationSnapshotParticipantIdSet.mockResolvedValue(new Set());

    await expect(
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1'),
    ).rejects.toMatchObject({
      response: profilesErrors.profileNotVisible().getResponse(),
    });
  });

  it('OFF_SEASON에서는 registration complete target도 detail을 열지 않는다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      ...seasonContext,
      state: 'OFF_SEASON',
    });

    await expect(
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1'),
    ).rejects.toMatchObject({
      response: profilesErrors.profileNotVisible().getResponse(),
    });
  });
});
