import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LifestyleData } from '@repo/shared/lifestyle';
import { ProfilesService } from '../application/profiles.service.js';
import { profilesErrors } from '../errors/profile.errors.js';
import { createProfileDetailEntryTokenCodec } from '../contracts/profile-detail-entry-token.codec.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../../season-participants/application/season-participants.service.js';
import { toCompleteLifestyleColumnData } from '../../season-participants/lifestyle/lifestyle-persistence.mapper.js';

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

const PUBLIC_COMPATIBILITY = {
  overallScore: 91,
  axes: [
    { id: 'SMOKING', score: 100, bucket: 'HIGH' },
    { id: 'CLEAN_LEVEL', score: 100, bucket: 'HIGH' },
  ],
  hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
} as const;

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

function detailEntryToken(input: {
  viewerUserId?: string;
  targetUserId?: string;
  targetParticipantId?: string;
  canViewFull?: boolean;
}) {
  return createProfileDetailEntryTokenCodec().sign({
    viewerUserId: input.viewerUserId ?? 'user-1',
    targetUserId: input.targetUserId ?? 'peer-1',
    targetParticipantId: input.targetParticipantId ?? 'participant-target',
    seasonId: 'season-1',
    issuedScope: 'SAME_BUILDING_ONLY',
    issuedRelation: 'GENERAL',
    issuedExposure: {
      listSummaryVisible: true,
      canViewFull: input.canViewFull ?? true,
      detailViewable: input.canViewFull ?? true,
      scoreVisible: input.canViewFull ?? true,
    },
    now: new Date('2026-02-10T03:00:00.000Z'),
  });
}

describe('ProfilesService Step 6 public detail', () => {
  const prisma = {
    getDatabaseNow: vi.fn(),
    campusMaster: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    seasonParticipant: {
      findFirst: vi.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: vi.fn(),
    selectCanonicalSelection: vi.fn(),
    findRegistrationSnapshotParticipantIdSet: vi.fn(),
  };
  const matchesService = {
    getLiveActiveMatchMapForParticipantIds: vi.fn(),
  };
  const matchScoreProjection = {
    shouldExposePublicMatchScore: vi.fn(),
    calculateQueryTimeRoommateSearchScore: vi.fn(),
    buildPublicProfileCompatibility: vi.fn(),
  };
  const blockVisibilityReader = {
    getExcludedTargetUserIds: vi.fn(),
  };
  const service = new ProfilesService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    matchesService as never,
    matchScoreProjection as never,
    blockVisibilityReader,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    blockVisibilityReader.getExcludedTargetUserIds.mockResolvedValue(new Set());
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
    matchScoreProjection.shouldExposePublicMatchScore.mockReturnValue(true);
    matchScoreProjection.calculateQueryTimeRoommateSearchScore.mockReturnValue(91);
    matchScoreProjection.buildPublicProfileCompatibility.mockReturnValue(PUBLIC_COMPATIBILITY);
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
      { detailEntryToken: detailEntryToken({}) },
    );

    expect(result).toMatchObject({
      id: 'peer-1',
      detailState: 'FULL',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { type: 'GENERAL' },
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      actions: {
        canBookmark: true,
        canRequestMatch: true,
        canStartChat: true,
      },
      resultRead: { resultReadable: false, context: 'NONE' },
      nickname: '시즌상대',
      intro: '상대 소개',
    });
    expect(result.detailState).toBe('FULL');
    if (result.detailState !== 'FULL') {
      throw new Error('expected full profile detail');
    }
    expect(result).toHaveProperty('matchScore', 91);
    expect(result).toHaveProperty('compatibility', PUBLIC_COMPATIBILITY);
    expect(result.compatibility?.overallScore).toBe(result.matchScore);
    expect(matchScoreProjection.buildPublicProfileCompatibility).toHaveBeenCalledWith({
      viewerLifestyle: COMPLETE_LIFESTYLE,
      targetLifestyle: COMPLETE_LIFESTYLE,
      scoreVisible: true,
    });
    const hiddenLifestyleFields = [
      'drinkingFrequency',
      'drinkingTolerance',
      'smokingTolerance',
      'phoneTolerance',
      'earphoneExpectation',
      'sleepEnvPreference',
      'screenTolerance',
      'indoorEatingTolerance',
      'cleanExpectation',
    ];
    for (const field of hiddenLifestyleFields) {
      expect(result.lifestyle).not.toHaveProperty(field);
    }
    expect(JSON.stringify(result.compatibility)).not.toContain('drinkingFrequency');
    expect(JSON.stringify(result.compatibility)).not.toContain('drinkingTolerance');
    expect(JSON.stringify(result.compatibility)).not.toContain('targetCondition');
  });

  it('scoreVisible=false FULL detail은 matchScore와 compatibility를 모두 제외한다', async () => {
    matchScoreProjection.shouldExposePublicMatchScore.mockReturnValue(false);
    const target = makeParticipant({
      id: 'participant-target',
      userId: 'peer-1',
      profile: {
        ...makeParticipant().profile!,
        participantId: 'participant-target',
      },
    });
    prisma.seasonParticipant.findFirst.mockResolvedValue(toRawParticipant(target, 'peer-1'));

    const result = await service.getProfileByUserId(
      { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
      'peer-1',
      { detailEntryToken: detailEntryToken({}) },
    );

    expect(result.detailState).toBe('FULL');
    if (result.detailState !== 'FULL') {
      throw new Error('expected full profile detail');
    }
    expect(result.exposure.scoreVisible).toBe(false);
    expect(result).not.toHaveProperty('matchScore');
    expect(result).not.toHaveProperty('compatibility');
    expect(matchScoreProjection.calculateQueryTimeRoommateSearchScore).not.toHaveBeenCalled();
    expect(matchScoreProjection.buildPublicProfileCompatibility).not.toHaveBeenCalled();
  });

  it('미등록 viewer는 summary entry token이 있어도 tombstone 안내만 받는다', async () => {
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
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1', {
        detailEntryToken: detailEntryToken({ canViewFull: false }),
      }),
    ).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
      tombstone: {
        reason: 'DETAIL_REQUIRES_REGISTRATION',
      },
    });
  });

  it('registration snapshot이 사라진 same-dormitory target은 tombstone detail로 degrade한다', async () => {
    prisma.seasonParticipant.findFirst.mockResolvedValue(
      toRawParticipant(makeParticipant({ id: 'participant-target', userId: 'peer-1' }), 'peer-1'),
    );
    seasonParticipantsService.findRegistrationSnapshotParticipantIdSet.mockResolvedValue(new Set());

    await expect(
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1', {
        detailEntryToken: detailEntryToken({}),
      }),
    ).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
      exposure: {
        detailViewable: true,
        canViewFull: false,
        scoreVisible: false,
      },
      tombstone: {
        reason: 'TARGET_NO_LONGER_DISCOVERABLE',
      },
    });
  });

  it('삭제 처리된 same-dormitory target은 retained payload 없이 tombstone detail을 반환한다', async () => {
    const target = toRawParticipant(
      makeParticipant({ id: 'participant-target', userId: 'peer-1' }),
      'peer-1',
    );
    prisma.seasonParticipant.findFirst.mockResolvedValue({
      ...target,
      user: {
        ...target.user,
        deletedAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    });

    await expect(
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1', {
        detailEntryToken: detailEntryToken({}),
      }),
    ).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
      exposure: {
        listSummaryVisible: false,
        detailViewable: true,
        canViewFull: false,
      },
      tombstone: {
        reason: 'TARGET_NO_LONGER_DISCOVERABLE',
        displayName: '탈퇴한 사용자',
      },
    });
  });

  it('active block relation이 있으면 direct detail probing도 fail-closed로 숨긴다', async () => {
    prisma.seasonParticipant.findFirst.mockResolvedValue(
      toRawParticipant(makeParticipant({ id: 'participant-target', userId: 'peer-1' }), 'peer-1'),
    );
    blockVisibilityReader.getExcludedTargetUserIds.mockResolvedValue(new Set(['peer-1']));

    await expect(
      service.getProfileByUserId({ id: 'user-1', gender: 'M', campus: 'CHUNCHEON' }, 'peer-1', {
        detailEntryToken: detailEntryToken({}),
      }),
    ).rejects.toMatchObject({
      response: profilesErrors.profileNotVisible().getResponse(),
    });
    expect(blockVisibilityReader.getExcludedTargetUserIds).toHaveBeenCalledWith({
      viewerUserId: 'user-1',
      targetUserIds: ['peer-1'],
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
