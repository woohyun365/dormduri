import { Injectable } from '@nestjs/common';
import {
  SERVICE_INTRO_NOTICE_KEY,
  type CurrentUserResponse,
  type DismissedNoticeState,
} from '@repo/shared/user-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import {
  hasParticipantProfile,
  isParticipantRegistered,
} from '../season-participants/season-participant-policy.js';
import { normalizeSelectionState } from '../season-participants/season-participant-selection.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserDismissedNoticeRecord,
  type UserDisplayIdentityRecord,
  type UserWithDisplayIdentityRecord,
} from './current-user-select.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from './service-state.js';

const currentUserSeasonParticipantSelect = {
  id: true,
  seasonId: true,
  userId: true,
  participationIntent: true,
  registeredAt: true,
  declinedAt: true,
  dormitoryId: true,
  dormitorySelectionState: true,
  participantStatus: true,
  hiddenByAdminAt: true,
  deactivatedAt: true,
  profile: {
    select: {
      participantId: true,
    },
  },
} as const;

type CurrentUserSeasonParticipantRecord = Prisma.SeasonParticipantGetPayload<{
  select: typeof currentUserSeasonParticipantSelect;
}>;

type CurrentUserResponseUserRecord = Omit<
  UserWithDisplayIdentityRecord,
  'displayIdentity' | 'dismissedNotices'
> & {
  displayIdentity?: UserDisplayIdentityRecord | null;
  dismissedNotices?: UserDismissedNoticeRecord[];
};

@Injectable()
export class CurrentUserViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchesService: MatchesService,
  ) {}

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithDisplayIdentity(authUser.id);
    return this.buildCurrentUserResponse(user, now);
  }

  async buildCurrentUserResponse(
    user: CurrentUserResponseUserRecord,
    now: Date,
  ): Promise<CurrentUserResponse> {
    if (!user.displayIdentity) {
      throw new Error('[CurrentUserViewService] user display identity row is required');
    }

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const currentParticipant = serviceState.seasonContext
      ? await this.prisma.seasonParticipant.findUnique({
          where: {
            seasonId_userId: {
              seasonId: serviceState.seasonContext.season.id,
              userId: user.id,
            },
          },
          select: currentUserSeasonParticipantSelect,
        })
      : null;

    const activeMatch =
      currentParticipant && serviceState.seasonContext
        ? await this.matchesService.getCurrentActiveMatchSummaryForParticipant(
            serviceState.seasonContext,
            currentParticipant.id,
            now,
          )
        : null;
    const participantRegistered = isParticipantRegistered(currentParticipant);
    const canonicalSelection = selectCanonicalSelection(currentParticipant, participantRegistered);
    const profileExists = hasParticipantProfile(currentParticipant);
    const activeSeasonPhase =
      serviceState.seasonState === 'SEASON_OPEN' || serviceState.seasonState === 'SEASON_MATCHING';
    const completion = buildSeasonProfileCompletion({
      hasCurrentSeason: Boolean(serviceState.seasonContext),
      campusOperated: serviceState.campusOperated,
      activeSeasonPhase,
      profileExists,
      selectionState: canonicalSelection.dormitorySelectionState,
    });
    const canSelectDormitory =
      serviceState.campusOperated &&
      activeSeasonPhase &&
      profileExists &&
      canonicalSelection.dormitorySelectionState !== 'ASSIGNED';
    const canFinalizeSeasonRegistration =
      serviceState.campusOperated &&
      activeSeasonPhase &&
      profileExists &&
      canonicalSelection.dormitorySelectionState === 'ASSIGNED' &&
      !participantRegistered;
    const canEditDisplayIdentity = !hasNicknameCooldown(
      user.displayIdentity.nicknameChangedAt,
      now,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.displayIdentity.nickname,
        gender: user.gender,
        campus: user.campus,
      },
      displayIdentity: {
        userId: user.displayIdentity.userId,
        nickname: user.displayIdentity.nickname,
        nicknameSource: 'USER_DISPLAY_IDENTITY',
        nicknameChangedAt: toNullableIsoDateTime(user.displayIdentity.nicknameChangedAt),
      },
      seasonProfile: {
        hasCurrentSeason: Boolean(serviceState.seasonContext),
        hasParticipantRow: Boolean(currentParticipant),
        intent: currentParticipant?.participationIntent ?? null,
        registered: participantRegistered,
        profileExists,
        profileState: resolveSeasonProfileState(currentParticipant, participantRegistered),
        completion,
        draftWritable: serviceState.campusOperated && activeSeasonPhase && !participantRegistered,
        canSelectDormitory,
        canFinalizeRegistration: canFinalizeSeasonRegistration,
      },
      selection: {
        state: canonicalSelection.dormitorySelectionState,
        dormitoryId: canonicalSelection.dormitoryId,
        source: canonicalSelection.source,
      },
      match: {
        hasActiveMatch: activeMatch !== null,
        activeMatch,
      },
      capabilities: {
        canBrowseProfiles:
          serviceState.campusOperated &&
          (serviceState.seasonState === 'SEASON_OPEN' ||
            serviceState.seasonState === 'SEASON_MATCHING' ||
            serviceState.seasonState === 'SEASON_POST_MATCH'),
        canCreateOrUpdateSeasonProfileDraft:
          serviceState.campusOperated && activeSeasonPhase && !participantRegistered,
        canSelectDormitory,
        canFinalizeSeasonRegistration,
        canEditDisplayIdentity,
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
      onboarding: {
        dismissedNotices: buildOnboardingDismissedNotices(user.dismissedNotices ?? []),
      },
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
    };
  }

  private async getUserWithDisplayIdentity(userId: string): Promise<UserWithDisplayIdentityRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: buildUserWithDisplayIdentitySelect(),
    });

    if (!user) {
      throw new Error('[CurrentUserViewService] authenticated user not found');
    }

    return mapUserWithDisplayIdentityProjection(user);
  }
}

function selectCanonicalSelection(
  participant: CurrentUserSeasonParticipantRecord | null,
  registered: boolean,
) {
  const normalized = normalizeSelectionState({
    registered,
    dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
    dormitoryId: participant?.dormitoryId ?? null,
  });

  return {
    ...normalized,
    source: 'SEASON_PARTICIPANT' as const,
  };
}

function resolveSeasonProfileState(
  participant: CurrentUserSeasonParticipantRecord | null,
  registered: boolean,
): CurrentUserResponse['seasonProfile']['profileState'] {
  if (!participant?.profile) {
    return 'NONE';
  }

  return registered ? 'REGISTRATION_FINALIZED' : 'DRAFT';
}

function buildSeasonProfileCompletion(input: {
  hasCurrentSeason: boolean;
  campusOperated: boolean;
  activeSeasonPhase: boolean;
  profileExists: boolean;
  selectionState: CurrentUserResponse['selection']['state'];
}): CurrentUserResponse['seasonProfile']['completion'] {
  const registrationUnavailableReasons: CurrentUserResponse['seasonProfile']['completion']['registrationUnavailableReasons'] =
    [];

  if (!input.hasCurrentSeason) {
    registrationUnavailableReasons.push('NO_CURRENT_SEASON');
  }
  if (!input.campusOperated) {
    registrationUnavailableReasons.push('UNSUPPORTED_CAMPUS');
  }
  if (input.hasCurrentSeason && !input.activeSeasonPhase) {
    registrationUnavailableReasons.push('SEASON_NOT_OPEN');
  }
  if (!input.profileExists) {
    registrationUnavailableReasons.push('PROFILE_INCOMPLETE');
  }
  if (input.profileExists && input.selectionState !== 'ASSIGNED') {
    registrationUnavailableReasons.push('DORMITORY_SELECTION_REQUIRED');
  }

  return {
    profileCompletionRequired: input.activeSeasonPhase && !input.profileExists,
    dormitorySelectionRequired:
      input.activeSeasonPhase && input.profileExists && input.selectionState !== 'ASSIGNED',
    registrationUnavailable: registrationUnavailableReasons.length > 0,
    registrationUnavailableReasons,
  };
}

function buildOnboardingDismissedNotices(
  dismissedNotices: UserDismissedNoticeRecord[],
): DismissedNoticeState[] {
  const serviceIntroNotice = dismissedNotices.find(
    (notice) => notice.noticeKey === SERVICE_INTRO_NOTICE_KEY,
  );

  return [
    {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
      dismissed: Boolean(serviceIntroNotice),
      dismissedAt: toNullableIsoDateTime(serviceIntroNotice?.dismissedAt ?? null),
    },
  ];
}

function toNullableIsoDateTime(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
