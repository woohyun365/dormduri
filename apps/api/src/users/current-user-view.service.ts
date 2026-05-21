import { Injectable } from '@nestjs/common';
import {
  SERVICE_INTRO_NOTICE_KEY,
  type CurrentUserResponse,
  type DismissedNoticeState,
} from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import { normalizeSelectionState } from '../season-participants/season-participant-selection.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
} from '../season-participants/season-participant-records.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import {
  buildCompletion,
  resolveSeasonProfileState,
} from '../season-participants/season-participant-write-owner.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserDismissedNoticeRecord,
  type UserDisplayIdentityRecord,
  type UserWithDisplayIdentityRecord,
} from './current-user-select.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from './service-state.js';
import { assertUserDisplayIdentity } from '../common/user-display-identity-invariant.js';
import { usersErrors } from './users.errors.js';

type CurrentUserResponseUserRecord = Omit<
  UserWithDisplayIdentityRecord,
  'displayIdentity' | 'dismissedNotices' | 'deletedAt'
> & {
  deletedAt?: Date | null;
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
    assertUserDisplayIdentity(user, () => usersErrors.accountIdentityIncomplete('current-user'));

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
          select: currentSeasonParticipantSelect,
        })
      : null;
    const mappedParticipant = currentParticipant
      ? mapCurrentSeasonParticipantRecord(currentParticipant)
      : null;

    const activeMatch =
      mappedParticipant && serviceState.seasonContext
        ? await this.matchesService.getCurrentActiveMatchSummaryForParticipant(
            serviceState.seasonContext,
            mappedParticipant.id,
            now,
          )
        : null;
    const participantRegistered = isParticipantRegistered(mappedParticipant);
    const canonicalSelection = selectCanonicalSelection(mappedParticipant, participantRegistered);
    const activeSeasonPhase =
      serviceState.seasonState === 'SEASON_OPEN' || serviceState.seasonState === 'SEASON_MATCHING';
    const participantRegistrationLocked = Boolean(
      mappedParticipant?.participationIntent === 'DECLINED' ||
      mappedParticipant?.participantStatus === 'WITHDRAWN' ||
      mappedParticipant?.withdrawnAt ||
      mappedParticipant?.declinedAt,
    );
    const accountOrParticipantInactive = Boolean(
      user.deletedAt || mappedParticipant?.hiddenByAdminAt || mappedParticipant?.deactivatedAt,
    );
    const profileComplete = this.seasonParticipantsService.validateSeasonProfileCompleteness(
      mappedParticipant?.profile,
    ).complete;
    const selectableDormitoriesAvailable = activeSeasonPhase
      ? mappedParticipant
        ? await this.seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant(
            mappedParticipant,
            serviceState.seasonContext,
            now,
          )
        : await this.seasonParticipantsService.hasSelectableDormitoriesForCurrentUser(
            {
              id: user.id,
              emailVerifiedAt: user.emailVerifiedAt,
              gender: user.gender,
              campus: user.campus,
            },
            serviceState.seasonContext,
            now,
          )
      : false;
    const validDormitorySelection = activeSeasonPhase
      ? await this.seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant(
          mappedParticipant,
          serviceState.seasonContext,
          now,
        )
      : false;
    const completion = buildCompletion({
      hasCurrentSeason: Boolean(serviceState.seasonContext),
      campusOperated: serviceState.campusOperated,
      activeSeasonPhase,
      profileComplete,
      dormitorySelectionReady: participantRegistered || validDormitorySelection,
      participantRegistrationLocked,
      accountOrParticipantInactive,
      hasSelectableDormitories: activeSeasonPhase ? selectableDormitoriesAvailable : undefined,
      roomSelectionClosed:
        serviceState.seasonState === 'SEASON_MATCHING' && !selectableDormitoriesAvailable,
    });
    const canCreateOrUpdateSeasonProfileDraft =
      serviceState.campusOperated &&
      activeSeasonPhase &&
      !participantRegistered &&
      !participantRegistrationLocked &&
      !accountOrParticipantInactive;
    const canSelectDormitory =
      serviceState.campusOperated &&
      activeSeasonPhase &&
      selectableDormitoriesAvailable &&
      !participantRegistered &&
      !participantRegistrationLocked &&
      !accountOrParticipantInactive;
    const canFinalizeSeasonRegistration =
      serviceState.campusOperated &&
      activeSeasonPhase &&
      profileComplete &&
      validDormitorySelection &&
      !participantRegistered &&
      !participantRegistrationLocked &&
      !accountOrParticipantInactive;
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
        hasParticipantRow: Boolean(mappedParticipant),
        intent: mappedParticipant?.participationIntent ?? null,
        registered: participantRegistered,
        profileExists: Boolean(mappedParticipant?.profile),
        profileState: resolveSeasonProfileState(mappedParticipant),
        completion,
        draftWritable: canCreateOrUpdateSeasonProfileDraft,
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
        canCreateOrUpdateSeasonProfileDraft: canCreateOrUpdateSeasonProfileDraft,
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
  participant: CurrentSeasonParticipantRecord | null,
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
