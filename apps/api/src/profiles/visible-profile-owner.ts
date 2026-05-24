import type { PublicProfile } from '@repo/shared/profile-contract';
import { isSeasonProfileComplete, type LifestyleData } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { MatchesService } from '../matches/matches.service.js';
import {
  buildDirectionalMatchScoreProjection,
  shouldExposePublicMatchScore,
} from '../matches/match-score-projection.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantProfileRecord,
} from '../season-participants/season-participant-records.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
} from '../season-participants/season-participant-policy.js';
import {
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
} from '../season-participants/season-participant-gate-context.js';
import { resolvePublicExposure } from '../season-participants/season-participant-exposure.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import { parseLifestyleOrNull, toPublicProfile, type ProfileViewRecord } from './profile.mapper.js';

interface VisibleProfileOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  matchesService: MatchesService;
}

export interface VisibleProfileViewerContext {
  viewer: {
    id: string;
    emailVerifiedAt: Date | null;
    gender: 'M' | 'F';
    campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  };
  viewerParticipant: CurrentSeasonParticipantRecord | null;
  viewerSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
  viewerLifestyle: LifestyleData | null;
  viewerSeasonProfileComplete: boolean;
  viewerHasOperatedAssignedDormitory: boolean;
  currentSeasonId: string | null;
  serviceState: {
    campusOperated: boolean;
    seasonState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null;
  };
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
}

export interface VisibleProfileTargetCandidate {
  user: {
    id: string;
    deletedAt: Date | null;
  };
  participant: CurrentSeasonParticipantRecord;
}

export interface ResolvedVisibleProfileEntry {
  user: VisibleProfileTargetCandidate['user'];
  targetParticipant: CurrentSeasonParticipantRecord;
  targetDormitoryId: string | null;
  sourceProfile: ProfileViewRecord;
  exposure: ReturnType<typeof resolvePublicExposure>;
  matchScore: number | null;
}

const userForProfileVisibilitySelect = {
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

type TargetParticipantQueryRecord = CurrentSeasonParticipantRecord & {
  user: { id: string; deletedAt: Date | null };
};

export function createVisibleProfileOwner(deps: VisibleProfileOwnerDeps) {
  async function loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
  ): Promise<VisibleProfileViewerContext> {
    const viewer = await deps.prisma.user.findUnique({
      where: { id: authUser.id },
      select: userForProfileVisibilitySelect,
    });
    if (!viewer || viewer.deletedAt) {
      throw new Error('[VisibleProfileOwner] authenticated viewer not found');
    }

    const serviceState = await resolveCampusServiceState(
      deps.prisma,
      deps.seasonsService,
      viewer.campus,
      now,
    );
    const viewerParticipant = await deps.seasonParticipantsService.ensureCurrentSeasonParticipant(
      viewer,
      now,
    );
    const viewerSelection =
      deps.seasonParticipantsService.selectCanonicalSelection(viewerParticipant);
    const operatedDormitoryIds = new Set(
      serviceState.seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? [],
    );
    const viewerLifestyle = parseLifestyleOrNull(viewerParticipant?.profile?.lifestyle ?? null);

    return {
      viewer,
      viewerParticipant,
      viewerSelection,
      viewerLifestyle,
      viewerSeasonProfileComplete:
        viewerLifestyle !== null && isSeasonProfileComplete(viewerLifestyle),
      viewerHasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
        operatedDormitoryIds,
        viewerSelection.dormitorySelectionState,
        viewerSelection.dormitoryId,
      ),
      currentSeasonId: serviceState.seasonContext?.season.id ?? null,
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
      operatedDormitoryIds,
      currentDormitoryCanMatch: canCurrentDormitoryMatch(
        serviceState.seasonContext,
        viewerSelection.dormitoryId,
        now,
      ),
    };
  }

  function resolveVisibleProfileEntry(
    candidate: VisibleProfileTargetCandidate,
    viewerContext: VisibleProfileViewerContext,
    viewerActiveMatch: Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>,
    activeMatchMap: Map<
      string,
      Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
    >,
    registrationSnapshotParticipantIds: ReadonlySet<string>,
  ): ResolvedVisibleProfileEntry | null {
    const targetParticipant = candidate.participant;
    const sourceProfile = toProfileViewRecord(targetParticipant.profile ?? null);
    if (!sourceProfile || candidate.user.deletedAt) {
      return null;
    }

    const targetSelection =
      deps.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
    const targetActiveMatch = activeMatchMap.get(targetParticipant.id) ?? null;
    const exposure = resolvePublicExposure(
      buildPublicExposureViewerInput({
        campusOperated: viewerContext.serviceState.campusOperated,
        seasonState: viewerContext.serviceState.seasonState,
        participant: viewerContext.viewerParticipant,
        matched: viewerActiveMatch !== null,
        seasonProfileComplete: viewerContext.viewerSeasonProfileComplete,
        matchedPartnerParticipantId: viewerActiveMatch?.counterpartParticipantId ?? null,
        selection: viewerContext.viewerSelection,
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        currentDormitoryCanMatch: viewerContext.currentDormitoryCanMatch,
      }),
      buildPublicExposureTargetInput({
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        participant: targetParticipant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
        registrationSnapshotExists: registrationSnapshotParticipantIds.has(targetParticipant.id),
      }),
    );

    if (!exposure.summaryVisible) {
      return null;
    }

    const targetLifestyle = parseLifestyleOrNull(sourceProfile.lifestyle);
    const scoreVisible = shouldExposePublicMatchScore({
      seasonState: viewerContext.serviceState.seasonState,
      scoreVisible: exposure.scoreVisible,
      relationToViewer: exposure.relationToViewer,
    });
    const matchScore = scoreVisible
      ? buildDirectionalMatchScoreProjection(viewerContext.viewerLifestyle, targetLifestyle)
      : null;

    return {
      user: candidate.user,
      targetParticipant,
      targetDormitoryId: targetSelection.dormitoryId,
      sourceProfile,
      exposure: {
        ...exposure,
        scoreVisible,
      },
      matchScore,
    };
  }

  async function materializeVisibleProfileEntries(
    viewerContext: VisibleProfileViewerContext,
    candidates: VisibleProfileTargetCandidate[],
  ): Promise<ResolvedVisibleProfileEntry[]> {
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      ...candidates.map((candidate) => candidate.participant.id),
    ].filter((participantId): participantId is string => participantId !== null);
    const registrationSnapshotParticipantIds =
      await deps.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet(
        candidates.map((candidate) => candidate.participant.id),
      );

    const activeMatchMap = viewerContext.currentSeasonId
      ? await deps.matchesService.getLiveActiveMatchMapForParticipantIds(
          viewerContext.currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerContext.viewerParticipant
      ? (activeMatchMap.get(viewerContext.viewerParticipant.id) ?? null)
      : null;

    return candidates
      .map((candidate) =>
        resolveVisibleProfileEntry(
          candidate,
          viewerContext,
          viewerActiveMatch,
          activeMatchMap,
          registrationSnapshotParticipantIds,
        ),
      )
      .filter((entry): entry is ResolvedVisibleProfileEntry => entry !== null)
      .sort((left, right) =>
        left.sourceProfile.nickname.localeCompare(right.sourceProfile.nickname, 'ko'),
      );
  }

  function mapTargetParticipantCandidate(
    record: TargetParticipantQueryRecord,
  ): VisibleProfileTargetCandidate {
    const { user, ...participant } = record;

    return {
      user,
      participant: mapCurrentSeasonParticipantRecord(
        participant as Parameters<typeof mapCurrentSeasonParticipantRecord>[0],
      ),
    };
  }

  async function getResolvedProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<ResolvedVisibleProfileEntry | null> {
    const viewerContext = await loadViewerContext(authUser, now);
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.serviceState.campusOperated ||
      viewerContext.serviceState.seasonState === null ||
      viewerContext.serviceState.seasonState === 'OFF_SEASON'
    ) {
      return null;
    }

    const rawParticipant = await deps.prisma.seasonParticipant.findFirst({
      where: {
        seasonId: viewerContext.currentSeasonId,
        userId: targetUserId,
        user: { deletedAt: null },
      },
      select: targetParticipantSelect,
    });
    if (!rawParticipant) {
      return null;
    }

    const [entry] = await materializeVisibleProfileEntries(viewerContext, [
      mapTargetParticipantCandidate(rawParticipant as unknown as TargetParticipantQueryRecord),
    ]);
    return entry ?? null;
  }

  function toDetailPublicProfile(entry: ResolvedVisibleProfileEntry): PublicProfile | null {
    if (!entry.exposure.canViewFull) {
      return null;
    }

    return toPublicProfile(
      {
        id: entry.user.id,
        gender: entry.targetParticipant.genderSnapshot,
        campus: entry.targetParticipant.campusCodeSnapshot,
      },
      entry.sourceProfile,
      {
        relationToViewer: entry.exposure.relationToViewer,
        actions: entry.exposure.actions,
        scoreVisible: entry.exposure.scoreVisible,
        ...(typeof entry.matchScore === 'number' ? { matchScore: entry.matchScore } : {}),
      },
    );
  }

  async function getDetailProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<PublicProfile | null> {
    const entry = await getResolvedProfileByUserId(authUser, targetUserId, now);
    if (!entry) {
      return null;
    }

    return toDetailPublicProfile(entry);
  }

  return {
    loadViewerContext,
    materializeVisibleProfileEntries,
    mapTargetParticipantCandidate,
    getResolvedProfileByUserId,
    getDetailProfileByUserId,
    toDetailPublicProfile,
  };
}

function toProfileViewRecord(
  profile: CurrentSeasonParticipantProfileRecord | null,
): ProfileViewRecord | null {
  if (!profile) {
    return null;
  }

  return {
    nickname: profile.nicknameSnapshot,
    nicknameNormalized: profile.nicknameNormalizedSnapshot,
    lifestyle: profile.lifestyle,
    intro: profile.intro,
    collegeCode: profile.collegeCode,
    grade: profile.grade,
    mbti: profile.mbti,
    birthYear: profile.birthYear,
  };
}
