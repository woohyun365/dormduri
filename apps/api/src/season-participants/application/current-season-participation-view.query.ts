import { Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { SeasonState } from '@repo/shared/season-contract';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { CurrentSeasonContext } from '../../seasons/season.types.js';
import { isParticipantRegistered } from '../policies/index.js';
import { normalizeSelectionState } from '../policies/season-participant-selection.policy.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';
import { SeasonParticipantsService } from './season-participants.service.js';
import { buildCompletion } from '../capabilities/season-participation-capability.mapper.js';
import {
  isParticipantInactive,
  isParticipantRegistrationLocked,
} from '../capabilities/season-participation-capability.policy.js';
import { resolveSeasonProfileState } from '../profile-draft/season-profile-draft.mapper.js';

interface CurrentUserSeasonSegmentUser {
  id: string;
  emailVerifiedAt: Date | null;
  gender: Gender;
  campus: Campus;
  deletedAt?: Date | null;
}

interface CurrentUserSeasonSegmentInput {
  user: CurrentUserSeasonSegmentUser;
  campusOperated: boolean;
  seasonState: SeasonState | null;
  seasonContext: CurrentSeasonContext | null;
  now: Date;
}

export interface CurrentUserSeasonParticipationSegment {
  participant: CurrentSeasonParticipantRecord | null;
  seasonProfile: CurrentUserResponse['seasonProfile'];
  selection: CurrentUserResponse['selection'];
  capabilities: Pick<
    CurrentUserResponse['capabilities'],
    'canCreateOrUpdateSeasonProfileDraft' | 'canSelectDormitory' | 'canFinalizeSeasonRegistration'
  >;
}

@Injectable()
export class CurrentSeasonParticipationViewQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

  async buildCurrentUserSeasonParticipationSegment(
    input: CurrentUserSeasonSegmentInput,
  ): Promise<CurrentUserSeasonParticipationSegment> {
    const currentParticipant = input.seasonContext
      ? await this.prisma.seasonParticipant.findUnique({
          where: {
            seasonId_userId: {
              seasonId: input.seasonContext.season.id,
              userId: input.user.id,
            },
          },
          select: currentSeasonParticipantSelect,
        })
      : null;
    const participant = currentParticipant
      ? mapCurrentSeasonParticipantRecord(currentParticipant)
      : null;

    const participantRegistered = isParticipantRegistered(participant);
    const canonicalSelection = selectCanonicalSelection(participant, participantRegistered);
    const activeSeasonPhase =
      input.seasonState === 'SEASON_OPEN' || input.seasonState === 'SEASON_MATCHING';
    const participantRegistrationLocked = participant
      ? isParticipantRegistrationLocked(participant)
      : false;
    const accountOrParticipantInactive = Boolean(
      input.user.deletedAt || (participant ? isParticipantInactive(participant) : false),
    );
    const profileComplete = this.seasonParticipantsService.validateSeasonProfileCompleteness(
      participant?.profile,
    ).complete;
    const selectableDormitoriesAvailable = activeSeasonPhase
      ? participant
        ? await this.seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant(
            participant,
            input.seasonContext,
            input.now,
          )
        : await this.seasonParticipantsService.hasSelectableDormitoriesForCurrentUser(
            {
              id: input.user.id,
              emailVerifiedAt: input.user.emailVerifiedAt,
              gender: input.user.gender,
              campus: input.user.campus,
            },
            input.seasonContext,
            input.now,
          )
      : false;
    const validDormitorySelection = activeSeasonPhase
      ? await this.seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant(
          participant,
          input.seasonContext,
          input.now,
        )
      : false;
    const completion = buildCompletion({
      hasCurrentSeason: Boolean(input.seasonContext),
      campusOperated: input.campusOperated,
      activeSeasonPhase,
      profileComplete,
      dormitorySelectionReady: participantRegistered || validDormitorySelection,
      participantRegistrationLocked,
      accountOrParticipantInactive,
      hasSelectableDormitories: activeSeasonPhase ? selectableDormitoriesAvailable : undefined,
      roomSelectionClosed:
        input.seasonState === 'SEASON_MATCHING' && !selectableDormitoriesAvailable,
    });
    const canCreateOrUpdateSeasonProfileDraft =
      input.campusOperated &&
      activeSeasonPhase &&
      !participantRegistered &&
      !participantRegistrationLocked &&
      !accountOrParticipantInactive;
    const canSelectDormitory =
      input.campusOperated &&
      activeSeasonPhase &&
      selectableDormitoriesAvailable &&
      !participantRegistered &&
      !participantRegistrationLocked &&
      !accountOrParticipantInactive;
    const canFinalizeSeasonRegistration =
      input.campusOperated &&
      activeSeasonPhase &&
      profileComplete &&
      validDormitorySelection &&
      !participantRegistered &&
      !participantRegistrationLocked &&
      !accountOrParticipantInactive;

    return {
      participant,
      seasonProfile: {
        hasCurrentSeason: Boolean(input.seasonContext),
        hasParticipantRow: Boolean(participant),
        intent: participant?.participationIntent ?? null,
        registered: participantRegistered,
        profileExists: Boolean(participant?.profile),
        profileState: resolveSeasonProfileState(participant),
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
      capabilities: {
        canCreateOrUpdateSeasonProfileDraft,
        canSelectDormitory,
        canFinalizeSeasonRegistration,
      },
    };
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
