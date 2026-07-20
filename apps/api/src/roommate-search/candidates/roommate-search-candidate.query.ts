import { PROFILE_MBTI_VALUES } from '@repo/shared/profile/contract';
import type {
  RoommateSearchQuery,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { currentSeasonParticipantSelect } from '../../season-participants/participants/season-participant-records.js';
import {
  toStoredBedtime,
  toStoredWakeTime,
} from '../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type { VisibleProfileViewerContext } from '../../profiles/contracts/profile-public-target-reader.port.js';
import { isParticipantRegistered } from '../../season-participants/policies/index.js';
import { buildCompleteSeasonParticipantProfileWhere } from '../../season-participants/policies/registration-complete-participant.prisma-policy.js';

export interface RoommateSearchCandidateQueryDeps {
  prisma: PrismaService;
}

export const roommateSearchTargetParticipantSelect = {
  ...currentSeasonParticipantSelect,
  user: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
} as const;

export type RoommateSearchTargetParticipantQueryRecord = Prisma.SeasonParticipantGetPayload<{
  select: typeof roommateSearchTargetParticipantSelect;
}>;

export function createRoommateSearchCandidateQuery(deps: RoommateSearchCandidateQueryDeps) {
  return {
    findCandidates(input: {
      viewerContext: VisibleProfileViewerContext;
      scope: RoommateSearchScope;
      query?: RoommateSearchQuery;
    }): Promise<RoommateSearchTargetParticipantQueryRecord[]> {
      if (
        !input.viewerContext.currentSeasonId ||
        input.viewerContext.serviceState.seasonState === 'OFF_SEASON'
      ) {
        return Promise.resolve([]);
      }

      if (
        input.scope === 'SAME_BUILDING_ONLY' &&
        !isParticipantRegistered(input.viewerContext.viewerParticipant)
      ) {
        return Promise.resolve([]);
      }

      return deps.prisma.seasonParticipant.findMany({
        where: buildRoommateSearchCandidateWhere(input),
        select: roommateSearchTargetParticipantSelect,
        orderBy: [{ profile: { nicknameNormalizedSnapshot: 'asc' } }, { id: 'asc' }],
      });
    },
  };
}

export function buildRoommateSearchCandidateWhere(input: {
  viewerContext: VisibleProfileViewerContext;
  scope: RoommateSearchScope;
  query?: RoommateSearchQuery;
}): Prisma.SeasonParticipantWhereInput {
  const profileWhere = input.query ? buildSeasonProfileWhere(input.query, input.viewerContext) : {};

  return {
    ...(input.viewerContext.viewerParticipant
      ? { id: { not: input.viewerContext.viewerParticipant.id } }
      : {}),
    seasonId: input.viewerContext.currentSeasonId ?? '',
    userId: { not: input.viewerContext.viewer.id },
    campusCodeSnapshot: input.viewerContext.viewer.campus,
    genderSnapshot: input.viewerContext.viewer.gender,
    user: {
      deletedAt: null,
    },
    participationIntent: 'REGISTERED',
    registeredAt: { not: null },
    declinedAt: null,
    dormitorySelectionState: 'ASSIGNED',
    dormitoryId:
      input.scope === 'SAME_BUILDING_ONLY'
        ? input.viewerContext.viewerSelection.dormitoryId
        : { not: null },
    participantStatus: { notIn: ['WITHDRAWN', 'EXPIRED'] },
    hiddenByAdminAt: null,
    deactivatedAt: null,
    profile: {
      is: {
        AND: [buildCompleteSeasonParticipantProfileWhere(), profileWhere],
      },
    },
  };
}

function buildSeasonProfileWhere(
  query: RoommateSearchQuery,
  viewerContext: VisibleProfileViewerContext,
): Prisma.SeasonParticipantProfileWhereInput {
  const mbtiWhere = buildMbtiWhere(query);
  const ageBandWhere = buildAgeBandWhere(query, viewerContext.seasonReferenceYear);

  return {
    ...(query.college !== undefined ? { collegeCode: toStringNullableFilter(query.college) } : {}),
    ...(query.grade !== undefined ? { grade: toStringNullableFilter(query.grade) } : {}),
    ...(mbtiWhere ? { mbti: mbtiWhere } : {}),
    ...(ageBandWhere ? { OR: ageBandWhere } : {}),
    ...(query.smokingBehavior !== undefined ? { smokingBehavior: query.smokingBehavior } : {}),
    ...(query.bedtime !== undefined
      ? {
          bedtime: toStoredBedtime(query.bedtime),
        }
      : {}),
    ...(query.wakeTime !== undefined
      ? {
          wakeTime: toStoredWakeTime(query.wakeTime),
        }
      : {}),
    ...(query.noiseSensitivity !== undefined ? { noiseSensitivity: query.noiseSensitivity } : {}),
    ...(query.cleanLevel !== undefined ? { cleanLevel: query.cleanLevel } : {}),
    ...(query.indoorEating !== undefined ? { indoorEating: query.indoorEating } : {}),
    ...(query.relationshipStyle !== undefined
      ? { relationshipStyle: query.relationshipStyle }
      : {}),
    ...(query.sleepHabit !== undefined
      ? query.sleepHabit === 'HAS'
        ? { sleepHabit: { not: 'NONE' } }
        : { sleepHabit: query.sleepHabit }
      : {}),
  };
}

function buildMbtiWhere(query: RoommateSearchQuery): Prisma.StringNullableFilter | null {
  const traits = query.mbtiTraits;
  if (!traits) {
    return null;
  }

  const selectedTraits: string[] = [];
  if (traits.energy) {
    selectedTraits.push(traits.energy);
  }
  if (traits.perception) {
    selectedTraits.push(traits.perception);
  }
  if (traits.decision) {
    selectedTraits.push(traits.decision);
  }
  if (traits.lifestyle) {
    selectedTraits.push(traits.lifestyle);
  }
  if (selectedTraits.length === 0) {
    return null;
  }

  const matchingValues = PROFILE_MBTI_VALUES.filter((value) =>
    selectedTraits.every((trait) => value.includes(trait)),
  );
  return { in: [...matchingValues] };
}

function buildAgeBandWhere(
  query: RoommateSearchQuery,
  seasonReferenceYear: number | null,
): Prisma.SeasonParticipantProfileWhereInput[] | null {
  if (!query.ageBand || !seasonReferenceYear) {
    return null;
  }

  return query.ageBand.values.map((value) => {
    if (value === '25_PLUS') {
      return { birthYear: { lte: seasonReferenceYear - 25 + 1 } };
    }

    return { birthYear: seasonReferenceYear - Number(value) + 1 };
  });
}

function toStringNullableFilter(filter: { operator: 'INCLUDE' | 'EXCLUDE'; values: string[] }) {
  return filter.operator === 'INCLUDE' ? { in: filter.values } : { notIn: filter.values };
}
