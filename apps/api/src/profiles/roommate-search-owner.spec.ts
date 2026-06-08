import type { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import { createRoommateSearchOwner } from './roommate-search-owner.js';
import {
  currentParticipant,
  currentProfile,
  profile,
  seasonContext,
  user,
  objectContaining,
} from '../season-participants/test-support/season-participants.spec-fixtures.js';

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

describe('roommate-search-owner bookmark integration', () => {
  it('visible search candidates만 bookmark metadata를 받고 hidden target은 bookmark로 되살아나지 않는다', async () => {
    const prisma = {
      getDatabaseNow: jest.fn().mockResolvedValue(now),
      campusMaster: {
        findUnique: jest.fn().mockResolvedValue({ isOperated: true }),
      },
      collegeMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            user({ id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M', deletedAt: null }),
          ),
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
      userBookmark: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ targetParticipantId: 'visible-participant', bookmarkedAt: now }]),
      },
    };
    const seasonsService = {
      getCurrentSeasonContext: jest.fn().mockResolvedValue(seasonContext({ state: 'SEASON_OPEN' })),
    };
    const seasonParticipantsService = {
      ensureCurrentSeasonParticipant: jest.fn().mockResolvedValue(registeredParticipant()),
      selectCanonicalSelection: jest
        .fn()
        .mockImplementation((participant: CanonicalSelectionInput) => ({
          dormitoryId: participant?.dormitoryId ?? null,
          dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
          source: 'SEASON_PARTICIPANT',
        })),
      findRegistrationSnapshotParticipantIdSet: jest
        .fn()
        .mockResolvedValue(new Set(['visible-participant', 'hidden-participant'])),
    };
    const matchesService = {
      getLiveActiveMatchMapForParticipantIds: jest.fn().mockResolvedValue(new Map()),
    };
    const owner = createRoommateSearchOwner({
      prisma: prisma as never,
      seasonsService: seasonsService as never,
      seasonParticipantsService: seasonParticipantsService as never,
      matchesService: matchesService as never,
    });

    const result = await owner.search(authUser, { scope: 'SAME_BUILDING_ONLY', limit: 20 });

    expect(prisma.userBookmark.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          viewerUserId: 'viewer-user',
          seasonId: 'season-1',
          targetParticipantId: { in: ['visible-participant'] },
          deletedAt: null,
          expiredAt: null,
        }),
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'visible-user',
      bookmark: { bookmarked: true, bookmarkedAt: now.toISOString() },
    });
    expect(result.items.map((item) => item.id)).not.toContain('hidden-user');
  });
});
