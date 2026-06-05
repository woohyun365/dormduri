import type {
  SeasonProfileDraftRequest,
  SeasonProfileDraftResponse,
  SeasonProfileState,
} from '@repo/shared/season-contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CurrentSeasonContext } from '../../seasons/season.types.js';
import {
  lifestyleFieldNames,
  toLifestyleColumnData,
} from '../lifestyle/lifestyle-persistence.mapper.js';
import { isParticipantRegistered } from '../policies/index.js';
import { canCurrentDormitoryMatch } from '../policies/season-participant-selection.policy.js';
import { buildCompletion } from '../capabilities/season-participation-capability.mapper.js';
import {
  isParticipantInactive,
  isParticipantLockedOrInactive,
  isParticipantRegistrationLocked,
} from '../capabilities/season-participation-capability.policy.js';
import { hasParticipantDormitorySelection } from '../dormitory-selection/dormitory-selection.policy.js';
import {
  toAdditionalProfileFromRecord,
  type CurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';
import type { VerifiedSeasonActionUser } from '../application/season-participant-use-case.deps.js';
import { validateSeasonProfileCompleteness } from './season-profile-completeness.policy.js';

export function toSeasonProfileDraftColumnData(
  input: SeasonProfileDraftRequest,
  displayIdentity: NonNullable<VerifiedSeasonActionUser['displayIdentity']>,
): Omit<Prisma.SeasonParticipantProfileUncheckedCreateInput, 'participantId'> {
  const additional = input.additional;
  return {
    nicknameSnapshot: displayIdentity.nickname,
    nicknameNormalizedSnapshot: displayIdentity.nicknameNormalized,
    ...toLifestyleColumnData(input.lifestyle),
    intro: (input.intro ?? '').trim(),
    grade: additional.grade,
    mbti: additional.mbti,
  };
}

export function resolveSeasonProfileState(
  participant: CurrentSeasonParticipantRecord | null | undefined,
): SeasonProfileState {
  if (!participant?.profile) {
    return 'NONE';
  }
  if (isParticipantRegistered(participant)) {
    return 'REGISTRATION_FINALIZED';
  }
  return validateSeasonProfileCompleteness(participant.profile).complete ? 'COMPLETE' : 'DRAFT';
}

export function buildEmptySeasonProfileDraftResponse(
  seasonContext: CurrentSeasonContext,
): SeasonProfileDraftResponse {
  const activeSeasonPhase = isSeasonProfileWritablePhase(seasonContext.state);

  return {
    participantId: null,
    seasonId: seasonContext.season.id,
    state: 'NONE',
    lifestyle: emptyLifestyle(),
    intro: '',
    additional: toAdditionalProfileFromRecord(null),
    completion: buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase,
      profileComplete: false,
      dormitorySelectionReady: false,
      participantRegistrationLocked: false,
      accountOrParticipantInactive: false,
    }),
    draftWritable: activeSeasonPhase,
  };
}

export function buildSeasonProfileDraftResponse(
  participant: CurrentSeasonParticipantRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
): SeasonProfileDraftResponse {
  const profileState = resolveSeasonProfileState(participant);
  const profileComplete = validateSeasonProfileCompleteness(participant.profile).complete;
  const activeSeasonPhase = isSeasonProfileWritablePhase(seasonContext.state);

  return {
    participantId: participant.id,
    seasonId: participant.seasonId,
    state: profileState,
    lifestyle: participant.profile?.lifestyle ?? emptyLifestyle(),
    intro: participant.profile?.intro ?? '',
    additional: toAdditionalProfileFromRecord(participant.profile),
    completion: buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase,
      profileComplete,
      dormitorySelectionReady: hasParticipantDormitorySelection(participant),
      participantRegistrationLocked: isParticipantRegistrationLocked(participant),
      accountOrParticipantInactive: isParticipantInactive(participant),
      roomSelectionClosed:
        participant.dormitoryId !== null &&
        seasonContext.state === 'SEASON_MATCHING' &&
        !canCurrentDormitoryMatch(seasonContext, participant.dormitoryId, now),
    }),
    draftWritable:
      activeSeasonPhase &&
      !isParticipantRegistered(participant) &&
      !isParticipantLockedOrInactive(participant),
  };
}

function isSeasonProfileWritablePhase(state: CurrentSeasonContext['state']) {
  return state === 'SEASON_OPEN' || state === 'SEASON_MATCHING';
}

function emptyLifestyle(): LifestyleData {
  return Object.fromEntries(lifestyleFieldNames.map((field) => [field, null])) as LifestyleData;
}
