interface RetainedDeletionIdentity {
  anonymizedActorKey: string;
  displayLabel: string;
}

export function buildAccountDeletionRetainedIdentityMetadata() {
  return {
    schemaVersion: 1,
    migration: {
      source: 'ACCOUNT_DELETE',
      note: 'immediate de-identification with five-day retained identifier anchor',
    },
    request: {
      requestedBy: 'USER',
      note: '계정 삭제 요청 수락 즉시 비식별화',
    },
  };
}

export function buildDeletedDisplayIdentityNormalized(retained: RetainedDeletionIdentity) {
  return `deleted-${retained.anonymizedActorKey}`;
}

export function buildDeletedEmail(retained: RetainedDeletionIdentity) {
  return `deleted+${retained.anonymizedActorKey}@deleted.local`;
}

export function buildDeletedPasswordHash(retained: RetainedDeletionIdentity) {
  return `deleted:${retained.anonymizedActorKey}`;
}

export function buildAccountDeletionDisplayAuditMetadata() {
  return {
    schemaVersion: 1,
    priority: 'ACCOUNT_DELETION_TOMBSTONE_OVERRIDES_DISPLAY_IDENTITY',
    requestedBy: 'USER',
  };
}

export function buildSeasonParticipantProfileDeidentificationData(
  retained: RetainedDeletionIdentity,
) {
  return {
    nicknameSnapshot: retained.displayLabel,
    nicknameNormalizedSnapshot: buildDeletedDisplayIdentityNormalized(retained),
    bedtime: null,
    wakeTime: null,
    sleepHabit: null,
    sleepEnvironment: null,
    screenUsage: null,
    noiseSensitivity: null,
    smokingBehavior: null,
    indoorEating: null,
    phoneBehavior: null,
    earphoneUsage: null,
    cleanLevel: null,
    drinkingFrequency: null,
    relationshipStyle: null,
    temperatureSensitivity: null,
    smokingTolerance: null,
    phoneTolerance: null,
    earphoneExpectation: null,
    sleepEnvPreference: null,
    screenTolerance: null,
    indoorEatingTolerance: null,
    cleanExpectation: null,
    drinkingTolerance: null,
    intro: '',
    collegeCode: null,
    grade: null,
    mbti: null,
    birthYear: null,
  };
}
