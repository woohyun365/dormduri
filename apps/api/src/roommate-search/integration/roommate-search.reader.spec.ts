import { describe, expect, it, vi } from 'vitest';
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
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
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
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: vi.fn().mockResolvedValue([
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
      loadViewerContext: vi.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: vi.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: vi.fn(
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
                  canStartChat: true,
                  unavailableReasons: [],
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
      getActiveBookmarkMetadata: vi
        .fn()
        .mockResolvedValue(new Map([['visible-participant', { bookmarkedAt: now }]])),
    };
    const blockVisibilityReader = {
      getExcludedTargetUserIds: vi.fn().mockResolvedValue(new Set()),
    };
    const matchRequestSearchMetadataReader = {
      getLivePendingRequestMetadata: vi.fn().mockResolvedValue(
        new Map([
          [
            'visible-participant',
            {
              requestId: 'request-1',
              direction: 'SENT' as const,
              createdAt: now,
              expiresAt: new Date('2026-02-12T03:00:00.000Z'),
            },
          ],
        ]),
      ),
      getDirectionLimitReachedMetadata: vi.fn().mockResolvedValue(new Map()),
    };
    const metrics = makeDomainMetrics();
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: bookmarkSearchMetadataReader,
      blockVisibilityReader: blockVisibilityReader,
      matchRequestSearchMetadataReader,
      chatThreadSearchMetadataReader: {
        getActiveThreadMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      metrics,
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
    expect(matchRequestSearchMetadataReader.getLivePendingRequestMetadata).toHaveBeenCalledWith({
      seasonId: 'season-1',
      viewerParticipantId: 'viewer-participant',
      targetParticipantIds: ['visible-participant'],
      now,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'visible-user',
      bookmark: { bookmarked: true, bookmarkedAt: now.toISOString() },
      pendingMatchRequest: {
        id: 'request-1',
        direction: 'SENT',
        createdAt: now.toISOString(),
        expiresAt: '2026-02-12T03:00:00.000Z',
      },
    });
    expect(result.items.map((item) => item.id)).not.toContain('hidden-user');
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_roommate_search_candidate_count',
      labels: { phase: 'raw' },
      value: 2,
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_roommate_search_candidate_count',
      labels: { phase: 'visible' },
      value: 1,
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_roommate_search_candidate_count',
      labels: { phase: 'score_filtered' },
      value: 1,
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_roommate_search_requests_total',
      labels: { outcome: 'success', sort: 'MATCH_SCORE' },
    });
    expect(JSON.stringify(metrics.incrementCounter.mock.calls)).not.toContain('viewer-user');
    expect(JSON.stringify(metrics.observeHistogram.mock.calls)).not.toContain('visible-user');
  });

  it('viewer to target 방향 요청 횟수를 초과한 후보는 search actions에서 매칭 요청을 닫는다', async () => {
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            targetRecord({ id: 'limit-participant', userId: 'limit-user', nickname: '가가' }),
          ]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: vi.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: vi.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: vi.fn(
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
                canStartChat: true,
                unavailableReasons: [],
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
    const matchRequestSearchMetadataReader = {
      getLivePendingRequestMetadata: vi.fn().mockResolvedValue(new Map()),
      getDirectionLimitReachedMetadata: vi.fn().mockResolvedValue(
        new Map([
          [
            'limit-participant',
            {
              targetParticipantId: 'limit-participant',
              directionCount: 5,
            },
          ],
        ]),
      ),
    };
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: {
        getActiveBookmarkMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      blockVisibilityReader: {
        getExcludedTargetUserIds: vi.fn().mockResolvedValue(new Set()),
      },
      matchRequestSearchMetadataReader,
      chatThreadSearchMetadataReader: {
        getActiveThreadMetadata: vi.fn().mockResolvedValue(new Map()),
      },
    });

    const result = await reader.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 });

    expect(matchRequestSearchMetadataReader.getDirectionLimitReachedMetadata).toHaveBeenCalledWith({
      seasonId: 'season-1',
      viewerParticipantId: 'viewer-participant',
      targetParticipantIds: ['limit-participant'],
    });
    expect(result.items[0]?.actions).toMatchObject({
      canRequestMatch: false,
      canStartChat: true,
      unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
    });
  });

  it('active matched viewer의 same-building search는 새 후보를 summary-only/action-closed로 유지한다', async () => {
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: vi.fn().mockResolvedValue([
          targetRecord({
            id: 'candidate-participant',
            userId: 'candidate-user',
            nickname: '가가',
          }),
        ]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: vi.fn().mockResolvedValue({
        ...context,
        serviceState: { campusOperated: true, seasonState: 'SEASON_MATCHING' },
        viewerParticipant: {
          ...context.viewerParticipant!,
          participantStatus: 'MATCHED',
          matchedAt: now,
        },
      }),
      mapTargetParticipantCandidate: vi.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: vi.fn(
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
                detailViewable: false,
                canViewFull: false,
                scoreVisible: false,
              },
              actions: {
                canBookmark: false,
                canRequestMatch: false,
                canStartChat: false,
                unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
              },
              resultRead: {
                canRead: false,
                reason: 'NOT_MATCHED_PARTNER',
              },
            },
            matchScore: null,
            viewerMatched: true,
            targetMatched: false,
          })),
      ),
    };
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: {
        getActiveBookmarkMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      blockVisibilityReader: {
        getExcludedTargetUserIds: vi.fn().mockResolvedValue(new Set()),
      },
      matchRequestSearchMetadataReader: {
        getLivePendingRequestMetadata: vi.fn().mockResolvedValue(new Map()),
        getDirectionLimitReachedMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      chatThreadSearchMetadataReader: {
        getActiveThreadMetadata: vi.fn().mockResolvedValue(new Map()),
      },
    });

    const result = await reader.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 });

    expect(result.scopeAvailability).toEqual({ campusMerged: true, sameBuildingOnly: true });
    expect(result.scope).toBe('SAME_BUILDING_ONLY');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'candidate-user',
      exposure: { detailViewable: false, canViewFull: false, scoreVisible: false },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
      },
    });
    expect(result.items[0]).not.toHaveProperty('matchScore');
  });

  it('OPEN chat thread가 있는 후보는 activeChatThread metadata를 search summary에 담는다', async () => {
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            targetRecord({ id: 'chat-participant', userId: 'chat-user', nickname: '가가' }),
          ]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: vi.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: vi.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: vi.fn(
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
                canStartChat: true,
                unavailableReasons: [],
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
    const activeThreadLastMessageAt = new Date('2026-02-10T04:00:00.000Z');
    const chatThreadSearchMetadataReader = {
      getActiveThreadMetadata: vi.fn().mockResolvedValue(
        new Map([
          [
            'chat-participant',
            {
              threadId: 'thread-1',
              targetParticipantId: 'chat-participant',
              threadKind: 'DIRECT' as const,
              status: 'OPEN' as const,
              lastMessageAt: activeThreadLastMessageAt,
            },
          ],
        ]),
      ),
    };
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: {
        getActiveBookmarkMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      blockVisibilityReader: {
        getExcludedTargetUserIds: vi.fn().mockResolvedValue(new Set()),
      },
      matchRequestSearchMetadataReader: {
        getLivePendingRequestMetadata: vi.fn().mockResolvedValue(new Map()),
        getDirectionLimitReachedMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      chatThreadSearchMetadataReader,
    });

    const result = await reader.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 });

    expect(chatThreadSearchMetadataReader.getActiveThreadMetadata).toHaveBeenCalledWith({
      seasonId: 'season-1',
      viewerParticipantId: 'viewer-participant',
      targetParticipantIds: ['chat-participant'],
    });
    expect(result.items[0]?.activeChatThread).toEqual({
      id: 'thread-1',
      threadKind: 'DIRECT',
      status: 'OPEN',
      lastMessageAt: activeThreadLastMessageAt.toISOString(),
    });
  });

  it('active block exclusion은 social-safety block visibility port 결과만 사용한다', async () => {
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            targetRecord({ id: 'visible-participant', userId: 'visible-user', nickname: '가가' }),
            targetRecord({ id: 'blocked-participant', userId: 'blocked-user', nickname: '나나' }),
          ]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: vi.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: vi.fn((record: TargetParticipantQueryRecord) => ({
        participant: record,
        user: record.user,
      })),
      materializeVisibleProfileEntries: vi.fn(
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
                canStartChat: true,
                unavailableReasons: [],
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
      getActiveBookmarkMetadata: vi.fn().mockResolvedValue(new Map()),
    };
    const blockVisibilityReader = {
      getExcludedTargetUserIds: vi.fn().mockResolvedValue(new Set(['blocked-user'])),
    };
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: bookmarkSearchMetadataReader,
      blockVisibilityReader: blockVisibilityReader,
      matchRequestSearchMetadataReader: {
        getLivePendingRequestMetadata: vi.fn().mockResolvedValue(new Map()),
        getDirectionLimitReachedMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      chatThreadSearchMetadataReader: {
        getActiveThreadMetadata: vi.fn().mockResolvedValue(new Map()),
      },
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

  it('metrics bridge failure does not fail roommate search', async () => {
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      collegeMaster: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const context = viewerContext();
    const publicProfileTargetReader = {
      loadViewerContext: vi.fn().mockResolvedValue(context),
      mapTargetParticipantCandidate: vi.fn(),
      materializeVisibleProfileEntries: vi.fn().mockResolvedValue([]),
    };
    const metrics = makeDomainMetrics();
    metrics.incrementCounter.mockImplementation(() => {
      throw new Error('metric rejected');
    });
    const reader = createRoommateSearchReader({
      prisma: prisma as never,
      publicProfileTargetReader: publicProfileTargetReader as never,
      bookmarkSearchMetadataReader: {
        getActiveBookmarkMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      blockVisibilityReader: {
        getExcludedTargetUserIds: vi.fn().mockResolvedValue(new Set()),
      },
      matchRequestSearchMetadataReader: {
        getLivePendingRequestMetadata: vi.fn().mockResolvedValue(new Map()),
        getDirectionLimitReachedMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      chatThreadSearchMetadataReader: {
        getActiveThreadMetadata: vi.fn().mockResolvedValue(new Map()),
      },
      metrics,
    });

    await expect(
      reader.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 }),
    ).resolves.toMatchObject({
      items: [],
    });
  });
});

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
