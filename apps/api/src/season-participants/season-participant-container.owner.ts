import type { Prisma } from '../generated/prisma/client.js';
import type { SeasonParticipantOwnerDeps, DbClient } from './season-participant-owner-deps.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
  type SeasonParticipantEnsureInput,
} from './season-participant-records.js';

export function buildSeasonParticipantCreateData(
  user: SeasonParticipantEnsureInput,
  seasonId: string,
  now: Date,
): Prisma.SeasonParticipantCreateManyInput {
  return {
    seasonId,
    userId: user.id,
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    participationIntent: 'UNDECIDED',
    participantStatus: 'NOT_STARTED',
    campusCodeSnapshot: user.campus,
    genderSnapshot: user.gender,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeasonParticipantContainerOwner(deps: SeasonParticipantOwnerDeps) {
  async function ensureCurrentSeasonParticipant(
    user: SeasonParticipantEnsureInput,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    if (!user.emailVerifiedAt) {
      return null;
    }

    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
    if (!seasonContext) {
      return null;
    }

    return ensureSeasonParticipantForSeason(user, seasonContext.season.id, now, tx);
  }

  async function ensureSeasonParticipantForSeason(
    user: SeasonParticipantEnsureInput,
    seasonId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    if (!user.emailVerifiedAt) {
      return null;
    }

    const client = tx ?? deps.prisma;
    const participant = await client.seasonParticipant.upsert({
      where: {
        seasonId_userId: {
          seasonId,
          userId: user.id,
        },
      },
      create: buildSeasonParticipantCreateData(user, seasonId, now),
      update: {},
      select: currentSeasonParticipantSelect,
    });

    return mapCurrentSeasonParticipantRecord(participant);
  }

  async function findCurrentSeasonParticipant(
    userId: string,
    seasonId: string,
    client: DbClient = deps.prisma,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    const participant = await client.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId,
          userId,
        },
      },
      select: currentSeasonParticipantSelect,
    });

    return participant ? mapCurrentSeasonParticipantRecord(participant) : null;
  }

  return {
    ensureCurrentSeasonParticipant,
    ensureSeasonParticipantForSeason,
    findCurrentSeasonParticipant,
  };
}

export type SeasonParticipantContainerOwner = ReturnType<
  typeof createSeasonParticipantContainerOwner
>;
