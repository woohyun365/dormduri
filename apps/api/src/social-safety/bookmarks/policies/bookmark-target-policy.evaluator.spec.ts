import type { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import { bookmarkErrors } from '../errors/bookmark.errors.js';
import { BookmarkTargetPolicyEvaluator } from './bookmark-target-policy.evaluator.js';
import {
  currentParticipant,
  currentProfile,
  profile,
  seasonContext,
  user,
} from '../../../season-participants/test-support/season-participants.spec-fixtures.js';

const now = new Date('2026-02-10T03:00:00.000Z');
const authUser = { id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M' } as never;
type CanonicalSelectionInput = Parameters<SeasonParticipantsService['selectCanonicalSelection']>[0];

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

function targetParticipant(overrides: Record<string, unknown> = {}) {
  return {
    ...registeredParticipant({
      id: 'target-participant',
      userId: 'target-user',
      profile: profile({ participantId: 'target-participant', nicknameSnapshot: '타겟' }),
    }),
    user: { id: 'target-user', deletedAt: null },
    ...overrides,
  } as never;
}

describe('BookmarkTargetPolicyEvaluator', () => {
  const prisma = {
    campusMaster: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    seasonParticipant: { findFirst: jest.fn() },
    activeMatch: { findMany: jest.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: jest.fn() };
  const seasonParticipantsService = {
    findCurrentSeasonParticipant: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    findRegistrationSnapshotParticipantIdSet: jest.fn(),
  };
  const matchScoreProjection = {
    calculateQueryTimeRoommateSearchScore: jest.fn(),
  };

  function evaluator() {
    return new BookmarkTargetPolicyEvaluator(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      matchScoreProjection as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    prisma.user.findUnique.mockResolvedValue(
      user({ id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M', deletedAt: null }),
    );
    prisma.seasonParticipant.findFirst.mockResolvedValue(targetParticipant());
    prisma.activeMatch.findMany.mockResolvedValue([]);
    seasonsService.getCurrentSeasonContext.mockResolvedValue(
      seasonContext({ state: 'SEASON_MATCHING' }),
    );
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      registeredParticipant(),
    );
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (participant: CanonicalSelectionInput) => ({
        dormitoryId: participant?.dormitoryId ?? null,
        dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
        source: 'SEASON_PARTICIPANT',
      }),
    );
    seasonParticipantsService.findRegistrationSnapshotParticipantIdSet.mockResolvedValue(
      new Set(['target-participant']),
    );
    matchScoreProjection.calculateQueryTimeRoommateSearchScore.mockReturnValue(92);
  });

  it('same-dorm visible target은 create target으로 resolve한다', async () => {
    await expect(
      evaluator().resolveCreateTarget({ authUser, targetUserId: 'target-user', now }),
    ).resolves.toMatchObject({
      targetUserId: 'target-user',
      targetParticipantId: 'target-participant',
      policy: { actions: { canBookmark: true } },
    });
  });

  it.each([
    ['hidden', { hiddenByAdminAt: now }],
    ['deactivated', { deactivatedAt: now }],
    ['withdrawn', { participantStatus: 'WITHDRAWN', withdrawnAt: now }],
    ['expired', { participantStatus: 'EXPIRED', expiredAt: now }],
    ['deleted/deidentified', { user: { id: 'target-user', deletedAt: now } }],
  ])(
    '%s target은 create target에서 probing-safe not-found로 닫힌다',
    async (_caseName, overrides) => {
      prisma.seasonParticipant.findFirst.mockResolvedValue(targetParticipant(overrides));

      await expect(
        evaluator().resolveCreateTarget({ authUser, targetUserId: 'target-user', now }),
      ).rejects.toMatchObject({
        response: bookmarkErrors.targetNotBookmarkable().getResponse(),
      });
    },
  );

  it('list item resolver도 hidden target을 되살리지 않고 null로 닫는다', async () => {
    const policy = evaluator();
    const viewerContext = await policy.loadViewerContext(authUser, now);

    await expect(
      policy.resolveVisibleListItem({
        viewerContext,
        bookmark: {
          id: 'bookmark-hidden',
          viewerUserId: 'viewer-user',
          seasonId: 'season-1',
          targetUserId: 'target-user',
          targetParticipantId: 'target-participant',
          bookmarkedAt: now,
          deletedAt: null,
          expiredAt: null,
          createdAt: now,
          updatedAt: now,
          targetUser: { id: 'target-user', deletedAt: null },
          targetParticipant: targetParticipant({ hiddenByAdminAt: now }),
        } as never,
      }),
    ).resolves.toBeNull();
  });
});
