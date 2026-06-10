import {
  CORE_LIFESTYLE_FIELDS,
  ROOMMATE_CONDITION_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import {
  toLifestyleFromColumns,
  toStoredBedtime,
  toStoredWakeTime,
} from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { buildDirectionalMatchScoreProjection } from '../../match-score-projection.js';
import type { SeasonHistoryParticipant } from './ended-season-history.loader.js';

export function buildHistoryScoreSnapshot(
  viewerParticipant: SeasonHistoryParticipant,
  counterpartParticipant: SeasonHistoryParticipant,
) {
  const viewerLifestyle = parseParticipantLifestyle(viewerParticipant);
  const counterpartLifestyle = parseParticipantLifestyle(counterpartParticipant);
  const scoreProjection = buildDirectionalMatchScoreProjection(
    viewerLifestyle,
    counterpartLifestyle,
  );

  return {
    matchScore: scoreProjection,
    viewerConditionSnapshot: viewerLifestyle
      ? pickLifestyleFields(viewerLifestyle, ROOMMATE_CONDITION_FIELDS)
      : null,
    viewerSelfSnapshot: viewerLifestyle
      ? pickLifestyleFields(viewerLifestyle, [
          'bedtime',
          'wakeTime',
          'relationshipStyle',
          'temperatureSensitivity',
        ] as const)
      : null,
    counterpartLifestyleSnapshot: counterpartLifestyle
      ? pickLifestyleFields(counterpartLifestyle, CORE_LIFESTYLE_FIELDS)
      : null,
  };
}

export function toHistorySnapshotColumns(input: ReturnType<typeof buildHistoryScoreSnapshot>) {
  return {
    viewerSmokingToleranceSnapshot: input.viewerConditionSnapshot?.smokingTolerance ?? null,
    viewerPhoneToleranceSnapshot: input.viewerConditionSnapshot?.phoneTolerance ?? null,
    viewerEarphoneExpectationSnapshot: input.viewerConditionSnapshot?.earphoneExpectation ?? null,
    viewerSleepEnvPreferenceSnapshot: input.viewerConditionSnapshot?.sleepEnvPreference ?? null,
    viewerScreenToleranceSnapshot: input.viewerConditionSnapshot?.screenTolerance ?? null,
    viewerIndoorEatingToleranceSnapshot:
      input.viewerConditionSnapshot?.indoorEatingTolerance ?? null,
    viewerCleanExpectationSnapshot: input.viewerConditionSnapshot?.cleanExpectation ?? null,
    viewerDrinkingToleranceSnapshot: input.viewerConditionSnapshot?.drinkingTolerance ?? null,
    viewerBedtimeSnapshot: input.viewerSelfSnapshot?.bedtime
      ? toStoredBedtime(input.viewerSelfSnapshot.bedtime)
      : null,
    viewerWakeTimeSnapshot: input.viewerSelfSnapshot?.wakeTime
      ? toStoredWakeTime(input.viewerSelfSnapshot.wakeTime)
      : null,
    viewerRelationshipStyleSnapshot: input.viewerSelfSnapshot?.relationshipStyle ?? null,
    viewerTemperatureSensitivitySnapshot: input.viewerSelfSnapshot?.temperatureSensitivity ?? null,
    counterpartBedtimeSnapshot: input.counterpartLifestyleSnapshot?.bedtime
      ? toStoredBedtime(input.counterpartLifestyleSnapshot.bedtime)
      : null,
    counterpartWakeTimeSnapshot: input.counterpartLifestyleSnapshot?.wakeTime
      ? toStoredWakeTime(input.counterpartLifestyleSnapshot.wakeTime)
      : null,
    counterpartSleepHabitSnapshot: input.counterpartLifestyleSnapshot?.sleepHabit ?? null,
    counterpartSleepEnvironmentSnapshot:
      input.counterpartLifestyleSnapshot?.sleepEnvironment ?? null,
    counterpartScreenUsageSnapshot: input.counterpartLifestyleSnapshot?.screenUsage ?? null,
    counterpartNoiseSensitivitySnapshot:
      input.counterpartLifestyleSnapshot?.noiseSensitivity ?? null,
    counterpartSmokingBehaviorSnapshot: input.counterpartLifestyleSnapshot?.smokingBehavior ?? null,
    counterpartIndoorEatingSnapshot: input.counterpartLifestyleSnapshot?.indoorEating ?? null,
    counterpartPhoneBehaviorSnapshot: input.counterpartLifestyleSnapshot?.phoneBehavior ?? null,
    counterpartEarphoneUsageSnapshot: input.counterpartLifestyleSnapshot?.earphoneUsage ?? null,
    counterpartCleanLevelSnapshot: input.counterpartLifestyleSnapshot?.cleanLevel ?? null,
    counterpartDrinkingFrequencySnapshot:
      input.counterpartLifestyleSnapshot?.drinkingFrequency ?? null,
    counterpartRelationshipStyleSnapshot:
      input.counterpartLifestyleSnapshot?.relationshipStyle ?? null,
    counterpartTemperatureSensitivitySnapshot:
      input.counterpartLifestyleSnapshot?.temperatureSensitivity ?? null,
  };
}

function parseParticipantLifestyle(participant: SeasonHistoryParticipant): LifestyleData | null {
  return toLifestyleFromColumns(participant.profile);
}

function pickLifestyleFields<const T extends readonly (keyof LifestyleData)[]>(
  lifestyle: LifestyleData,
  fields: T,
) {
  return Object.fromEntries(fields.map((field) => [field, lifestyle[field]])) as Pick<
    LifestyleData,
    T[number]
  >;
}
