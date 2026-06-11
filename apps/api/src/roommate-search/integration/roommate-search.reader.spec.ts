import type {
  PublicProfileTargetCandidate,
  TargetParticipantQueryRecord,
  VisibleProfileViewerContext,
} from '../../profiles/contracts/profile-public-target-reader.port.js';
import {
  currentParticipant,
  currentProfile,
  profile,
} from '../../season-participants/test-support/season-participants.spec-fixtures.js';
import { createRoommateSearchReader } from './roommate-search.reader.js';

const now = new Date('2026-02-10T03:00:00.000Z');
const authUser = { id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M' } as never;

const COMPLETE_LIFESTYLE = {
  smokingBehavior: 'NO',
  sleepHabit: 'NONE',
  relationshipStyle: 'CLOSE',
} as never;

function registeredParticipant(overrides: Record<string, unknown> = {}) {
  return currentParticipant({
    id: 'viewer-participant',
    userId: 'viewer-user',
    participationIntent: 'REGISTERED',
    registeredAt: now,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    activatedAt: now,
    profile: currentProfile({ participantId: 'viewer-participant' }),
    ...overrides,
  });
}

function targetRecord(input: {
  id: string;
  userId: string;
  nickname: string;
  hiddenByAdminAt?: Date | null;
}) {
  return {
    ...registeredParticipant({
      id: input.id,
      userId: input.userId,
      profile: profile({
        participantId: input.id,
        nicknameSnapshot: input.nickname,
        nicknameNormalizedSnapshot: input.nickname,
      }),
      hiddenByAdminAt: input.hiddenByAdminAt ?? null,
    }),
    user: { id: input.userId, deletedAt: null },
  } as never;
}

function viewerContext(): VisibleProfileViewerContext {
  return {
    viewer: {
      id: 'viewer-user',
      emailVerifiedAt: now,
      campus: 'CHUNCHEON',
      gender: 'M',
    },
    viewerParticipant: registeredParticipant() as NonNullable<
      VisibleProfileViewerContext['viewerParticipant']
    >,
    viewerSelection: {
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      source: 'SEASON_PARTICIPANT',
    },
    viewerLifestyle: null,
    viewerSeasonProfileComplete: true,
    viewerHasOperatedAssignedDormitory: true,
    currentSeasonId: 'season-1',
    seasonReferenceYear: 2026,
    serviceState: {
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
    },
    operatedDormitoryIds: new Set(['dasan']),
    currentDormitoryCanMatch: true,
  };
}

describe('roommate-search.reader bookmark integration', () => {
  it('visible search candidates만 bookmark metadata를 받고 hidden target은 bookmark로 되살아나지 않는다', async () => {
    const prisma = {
      getDatabaseNow: jest.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: jest.fn().mockResolvedValue([
          targetRecord({ id: 'visible-participant', userId: 'visible-user', nickname: '가가' }),
          targetRecord({
            id: 'hidden-participant',
            userId: 'hidden-user',
            nickname: '나나',
            hiddenByAdminAt: now,
          }),
        ]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: jest.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: jest.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: jest.fn(
        (_viewerContext: VisibleProfileViewerContext, candidates: PublicProfileTargetCandidate[]) =>
          candidates
            .filter((candidate) => candidate.participant.id === 'visible-participant')
            .map((candidate) => ({
              user: candidate.user,
              targetParticipant: candidate.participant,
              targetDormitoryId: candidate.participant.dormitoryId,
              sourceProfile: {
                nickname: '가가',
                nicknameNormalized: '가가',
                intro: '소개',
                lifestyle: COMPLETE_LIFESTYLE,
              },
              publicTargetPolicy: {
                sourceProfile: 'CURRENT_SEASON_PROFILE',
                relation: { relationToViewer: 'GENERAL' },
                exposure: {
                  detailViewable: true,
                  canViewFull: true,
                  scoreVisible: true,
                },
                actions: {
                  canBookmark: true,
                  canRequestMatch: true,
                },
                resultRead: {
                  canRead: true,
                  reason: null,
                },
              },
              matchScore: 88,
              viewerMatched: false,
              targetMatched: false,
            })),
      ),
    };
    const bookmarkSearchMetadataReader = {
      getActiveBookmarkMetadata: jest
        .fn()
        .mockResolvedValue(new Map([['visible-participant', { bookmarkedAt: now }]])),
    };
    const blockVisibilityReader = {
      getExcludedTargetUserIds: jest.fn().mockResolvedValue(new Set()),
    };
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: bookmarkSearchMetadataReader as never,
      blockVisibilityReader: blockVisibilityReader as never,
    });

    const result = await reader.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 });

    expect(blockVisibilityReader.getExcludedTargetUserIds).toHaveBeenCalledWith({
      viewerUserId: 'viewer-user',
      targetUserIds: ['visible-user'],
    });
    expect(bookmarkSearchMetadataReader.getActiveBookmarkMetadata).toHaveBeenCalledWith({
      viewerUserId: 'viewer-user',
      seasonId: 'season-1',
      targetParticipantIds: ['visible-participant'],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'visible-user',
      bookmark: { bookmarked: true, bookmarkedAt: now.toISOString() },
    });
    expect(result.items.map((item) => item.id)).not.toContain('hidden-user');
  });

  it('active block exclusion은 social-safety block visibility port 결과만 사용한다', async () => {
    const prisma = {
      getDatabaseNow: jest.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            targetRecord({ id: 'visible-participant', userId: 'visible-user', nickname: '가가' }),
            targetRecord({ id: 'blocked-participant', userId: 'blocked-user', nickname: '나나' }),
          ]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: jest.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: jest.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: jest.fn(
        (_viewerContext: VisibleProfileViewerContext, candidates: PublicProfileTargetCandidate[]) =>
          candidates.map((candidate) => ({
            user: candidate.user,
            targetParticipant: candidate.participant,
            targetDormitoryId: candidate.participant.dormitoryId,
            sourceProfile: {
              nickname: candidate.participant.profile?.nicknameSnapshot ?? '닉네임',
              nicknameNormalized:
                candidate.participant.profile?.nicknameNormalizedSnapshot ?? '닉네임',
              intro: '소개',
              lifestyle: COMPLETE_LIFESTYLE,
            },
            publicTargetPolicy: {
              sourceProfile: 'CURRENT_SEASON_PROFILE',
              relation: { relationToViewer: 'GENERAL' },
              exposure: {
                detailViewable: true,
                canViewFull: true,
                scoreVisible: true,
              },
              actions: {
                canBookmark: true,
                canRequestMatch: true,
              },
              resultRead: {
                canRead: true,
                reason: null,
              },
            },
            matchScore: 88,
            viewerMatched: false,
            targetMatched: false,
          })),
      ),
    };
    const bookmarkSearchMetadataReader = {
      getActiveBookmarkMetadata: jest.fn().mockResolvedValue(new Map()),
    };
    const blockVisibilityReader = {
      getExcludedTargetUserIds: jest.fn().mockResolvedValue(new Set(['blocked-user'])),
    };
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: bookmarkSearchMetadataReader as never,
      blockVisibilityReader: blockVisibilityReader as never,
    });

    const result = await reader.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 });

    expect(blockVisibilityReader.getExcludedTargetUserIds).toHaveBeenCalledWith({
      viewerUserId: 'viewer-user',
      targetUserIds: ['visible-user', 'blocked-user'],
    });
    expect(bookmarkSearchMetadataReader.getActiveBookmarkMetadata).toHaveBeenCalledWith({
      viewerUserId: 'viewer-user',
      seasonId: 'season-1',
      targetParticipantIds: ['visible-participant'],
    });
    expect(result.items.map((item) => item.id)).toEqual(['visible-user']);
  });
});
