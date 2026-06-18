import { Inject, Injectable } from '@nestjs/common';
import {
  isSeasonProfileComplete,
  lifestyleSchema,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { Campus, Gender } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  MATCH_SCORE_PROJECTION_PORT,
  type MatchScoreProjectionPort,
} from '../../../matches/application/ports/match-score-projection.port.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantQueryRecord,
  type CurrentSeasonParticipantRecord,
} from '../../../season-participants/participants/season-participant-records.js';
import { canCurrentDormitoryMatch } from '../../../season-participants/policies/index.js';
import {
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
  resolvePublicTargetPolicy,
  type PublicTargetPolicy,
} from '../../../season-participants/public-target-policy/index.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { resolveCampusServiceState } from '../../../seasons/runtime/campus-service-state.query.js';
import { bookmarkErrors } from '../errors/bookmark.errors.js';
import type { BookmarkListItem } from '@repo/shared/social-safety/bookmark';
import type { BookmarkListRecord } from '../repositories/bookmark.repository.js';

export interface BookmarkViewerContext {
  viewer: {
    id: string;
    emailVerifiedAt: Date | null;
    gender: Gender;
    campus: Campus;
    deletedAt: Date | null;
  };
  currentSeasonId: string | null;
  seasonContext: CurrentSeasonContext | null;
  serviceState: {
    campusOperated: boolean;
    seasonState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null;
  };
  viewerParticipant: CurrentSeasonParticipantRecord | null;
  viewerSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
  viewerLifestyle: LifestyleData | null;
  viewerSeasonProfileComplete: boolean;
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
}

export interface ResolvedBookmarkTarget {
  viewerContext: BookmarkViewerContext;
  targetUserId: string;
  targetParticipantId: string;
  profileSummary: BookmarkListItem['profileSummary'];
  matchScore: number | null;
  policy: PublicTargetPolicy;
}

type TargetParticipantRecord = CurrentSeasonParticipantQueryRecord & {
  user: { id: string; deletedAt: Date | null };
};

type BookmarkPolicyClient = Prisma.TransactionClient;

const bookmarkViewerSelect = {
  id: true,
  emailVerifiedAt: true,
  gender: true,
  campus: true,
  deletedAt: true,
} as const;

const targetParticipantSelect = {
  ...currentSeasonParticipantSelect,
  user: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
} as const;

@Injectable()
export class BookmarkTargetPolicyEvaluator {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(MATCH_SCORE_PROJECTION_PORT)
    private readonly matchScoreProjection: MatchScoreProjectionPort,
  ) {}

  async resolveCreateTarget(input: {
    authUser: AuthenticatedUserContext;
    targetUserId: string;
    now: Date;
    client?: BookmarkPolicyClient;
  }): Promise<ResolvedBookmarkTarget> {
    if (input.authUser.id === input.targetUserId) {
      throw bookmarkErrors.targetNotBookmarkable();
    }

    const viewerContext = await this.loadViewerContext(input.authUser, input.now, input.client);
    if (!viewerContext.currentSeasonId) {
      throw bookmarkErrors.targetNotBookmarkable();
    }

    const target = await this.findTargetParticipant({
      client: input.client,
      seasonId: viewerContext.currentSeasonId,
      targetUserId: input.targetUserId,
      viewerCampus: viewerContext.viewer.campus,
      viewerGender: viewerContext.viewer.gender,
    });
    if (!target) {
      throw bookmarkErrors.targetNotBookmarkable();
    }

    const resolved = await this.resolveTargetForPolicy({
      client: input.client,
      viewerContext,
      target,
    });
    if (!resolved.policy.actions.canBookmark) {
      throw bookmarkErrors.targetNotBookmarkable();
    }

    return resolved;
  }

  async loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
    client?: BookmarkPolicyClient,
  ): Promise<BookmarkViewerContext> {
    const db = client ?? this.prisma;
    const viewer = await db.user.findUnique({
      where: { id: authUser.id },
      select: bookmarkViewerSelect,
    });
    if (!viewer || viewer.deletedAt) {
      throw bookmarkErrors.targetNotBookmarkable();
    }

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      viewer.campus,
      now,
    );
    const seasonContext = serviceState.seasonContext;
    const viewerParticipant = seasonContext
      ? await this.seasonParticipantsService.findCurrentSeasonParticipant(
          viewer.id,
          seasonContext.season.id,
          client,
        )
      : null;
    const viewerSelection =
      this.seasonParticipantsService.selectCanonicalSelection(viewerParticipant);
    const operatedDormitoryIds = new Set(
      seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? [],
    );
    const viewerLifestyle = parseLifestyleOrNull(viewerParticipant?.profile?.lifestyle ?? null);

    return {
      viewer,
      currentSeasonId: seasonContext?.season.id ?? null,
      seasonContext,
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
      viewerParticipant,
      viewerSelection,
      viewerLifestyle,
      viewerSeasonProfileComplete:
        viewerLifestyle !== null && isSeasonProfileComplete(viewerLifestyle),
      operatedDormitoryIds,
      currentDormitoryCanMatch: canCurrentDormitoryMatch(
        seasonContext,
        viewerSelection.dormitoryId,
        now,
      ),
    };
  }

  async resolveVisibleListItem(input: {
    viewerContext: BookmarkViewerContext;
    bookmark: BookmarkListRecord;
    client?: BookmarkPolicyClient;
  }): Promise<ResolvedBookmarkTarget | null> {
    const resolved = await this.resolveTargetForPolicy({
      client: input.client,
      viewerContext: input.viewerContext,
      target: {
        ...input.bookmark.targetParticipant,
        user: input.bookmark.targetUser,
      },
    });

    return resolved.policy.exposure.listSummaryVisible ? resolved : null;
  }

  private async findTargetParticipant(input: {
    client?: BookmarkPolicyClient;
    seasonId: string;
    targetUserId: string;
    viewerCampus: Campus;
    viewerGender: Gender;
  }): Promise<TargetParticipantRecord | null> {
    const db = input.client ?? this.prisma;
    return db.seasonParticipant.findFirst({
      where: {
        seasonId: input.seasonId,
        userId: input.targetUserId,
        user: {
          campus: input.viewerCampus,
          gender: input.viewerGender,
        },
      },
      select: targetParticipantSelect,
    });
  }

  private async resolveTargetForPolicy(input: {
    client?: BookmarkPolicyClient;
    viewerContext: BookmarkViewerContext;
    target: TargetParticipantRecord;
  }): Promise<ResolvedBookmarkTarget> {
    const targetParticipant = mapCurrentSeasonParticipantRecord(input.target);
    const targetSelection =
      this.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
    const registrationSnapshotParticipantIds =
      await this.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet(
        [targetParticipant.id],
        input.client,
      );
    const activeMatchMap = await this.loadActiveMatchMap({
      client: input.client,
      seasonId: input.viewerContext.currentSeasonId,
      participantIds: [input.viewerContext.viewerParticipant?.id ?? null, targetParticipant.id],
    });
    const viewerActiveMatch = input.viewerContext.viewerParticipant
      ? (activeMatchMap.get(input.viewerContext.viewerParticipant.id) ?? null)
      : null;
    const targetActiveMatch = activeMatchMap.get(targetParticipant.id) ?? null;
    const policy = resolvePublicTargetPolicy(
      buildPublicTargetPolicyViewerInput({
        campusOperated: input.viewerContext.serviceState.campusOperated,
        seasonState: input.viewerContext.serviceState.seasonState,
        participant: input.viewerContext.viewerParticipant,
        matched: viewerActiveMatch !== null,
        seasonProfileComplete: input.viewerContext.viewerSeasonProfileComplete,
        matchedPartnerParticipantId: viewerActiveMatch?.counterpartParticipantId ?? null,
        selection: input.viewerContext.viewerSelection,
        operatedDormitoryIds: input.viewerContext.operatedDormitoryIds,
        currentDormitoryCanMatch: input.viewerContext.currentDormitoryCanMatch,
      }),
      buildPublicTargetPolicyTargetInput({
        operatedDormitoryIds: input.viewerContext.operatedDormitoryIds,
        participant: targetParticipant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
        registrationSnapshotExists: registrationSnapshotParticipantIds.has(targetParticipant.id),
        deletedOrDeidentified: input.target.user.deletedAt !== null,
      }),
    );
    const targetLifestyle = parseLifestyleOrNull(targetParticipant.profile?.lifestyle ?? null);
    const matchScore = this.matchScoreProjection.calculateQueryTimeRoommateSearchScore({
      viewerLifestyle: input.viewerContext.viewerLifestyle,
      targetLifestyle,
      scoreVisible: policy.exposure.scoreVisible,
    });

    return {
      viewerContext: input.viewerContext,
      targetUserId: input.target.user.id,
      targetParticipantId: targetParticipant.id,
      profileSummary: toBookmarkProfileSummary(targetParticipant),
      matchScore,
      policy,
    };
  }

  private async loadActiveMatchMap(input: {
    client?: BookmarkPolicyClient;
    seasonId: string | null;
    participantIds: readonly (string | null)[];
  }) {
    const participantIds = input.participantIds.filter(
      (participantId): participantId is string => participantId !== null,
    );
    if (!input.seasonId || participantIds.length === 0) {
      return new Map<string, { counterpartParticipantId: string }>();
    }

    const db = input.client ?? this.prisma;
    const matches = await db.activeMatch.findMany({
      where: {
        seasonId: input.seasonId,
        status: 'ACTIVE',
        endedAt: null,
        OR: [
          { participantAId: { in: participantIds } },
          { participantBId: { in: participantIds } },
        ],
      },
      select: {
        participantAId: true,
        participantBId: true,
      },
    });
    const map = new Map<string, { counterpartParticipantId: string }>();
    for (const match of matches) {
      map.set(match.participantAId, { counterpartParticipantId: match.participantBId });
      map.set(match.participantBId, { counterpartParticipantId: match.participantAId });
    }
    return map;
  }
}

function parseLifestyleOrNull(input: unknown): LifestyleData | null {
  const parsed = lifestyleSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function toBookmarkProfileSummary(
  participant: CurrentSeasonParticipantRecord,
): BookmarkListItem['profileSummary'] {
  const profile = participant.profile;
  if (!profile) {
    return null;
  }

  return {
    nickname: profile.nicknameSnapshot,
    intro: profile.intro,
    smokingBehavior: profile.lifestyle.smokingBehavior,
    sleepHabit: profile.lifestyle.sleepHabit,
    relationshipStyle: profile.lifestyle.relationshipStyle,
  };
}
