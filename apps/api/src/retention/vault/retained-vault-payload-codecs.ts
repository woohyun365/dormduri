export interface RetainedNicknameAuditPayload {
  schemaVersion: 1;
  event: Record<string, unknown>;
}

export interface RetainedAcademicIdentityAuditPayload {
  schemaVersion: 1;
  event: Record<string, unknown>;
}

export interface RetainedSeasonProfileHistoryPayload {
  schemaVersion: 1;
  history: Record<string, unknown>;
}

export interface RetainedMatchHistoryPayload {
  schemaVersion: 1;
  subjectRole: 'VIEWER' | 'COUNTERPART';
  entry: Record<string, unknown>;
}

export function parseRetainedNicknameAuditPayload(payload: unknown): RetainedNicknameAuditPayload {
  const candidate = asRecord(payload, '[retained-vault-owner] nickname audit payload invalid');
  const event = asRecord(candidate.event, '[retained-vault-owner] nickname audit payload invalid');
  if (candidate.schemaVersion !== 1 || typeof event.id !== 'string') {
    throw new Error('[retained-vault-owner] nickname audit payload invalid');
  }

  return { schemaVersion: 1, event };
}

export function parseRetainedAcademicIdentityAuditPayload(
  payload: unknown,
): RetainedAcademicIdentityAuditPayload {
  const candidate = asRecord(
    payload,
    '[retained-vault-owner] academic identity audit payload invalid',
  );
  const event = asRecord(
    candidate.event,
    '[retained-vault-owner] academic identity audit payload invalid',
  );
  if (
    candidate.schemaVersion !== 1 ||
    typeof event.id !== 'string' ||
    typeof event.previousCollegeCode !== 'string' ||
    typeof event.nextCollegeCode !== 'string'
  ) {
    throw new Error('[retained-vault-owner] academic identity audit payload invalid');
  }

  return { schemaVersion: 1, event };
}

export function parseRetainedSeasonProfileHistoryPayload(
  payload: unknown,
): RetainedSeasonProfileHistoryPayload {
  const candidate = asRecord(payload, '[retained-vault-owner] profile history payload invalid');
  const history = asRecord(
    candidate.history,
    '[retained-vault-owner] profile history payload invalid',
  );
  if (
    candidate.schemaVersion !== 1 ||
    typeof history.id !== 'string' ||
    typeof history.participantId !== 'string'
  ) {
    throw new Error('[retained-vault-owner] profile history payload invalid');
  }

  return { schemaVersion: 1, history };
}

export function parseRetainedMatchHistoryPayload(payload: unknown): RetainedMatchHistoryPayload {
  const candidate = asRecord(payload, '[retained-vault-owner] match history payload invalid');
  const entry = asRecord(candidate.entry, '[retained-vault-owner] match history payload invalid');
  if (
    candidate.schemaVersion !== 1 ||
    (candidate.subjectRole !== 'VIEWER' && candidate.subjectRole !== 'COUNTERPART') ||
    typeof entry.id !== 'string'
  ) {
    throw new Error('[retained-vault-owner] match history payload invalid');
  }

  return { schemaVersion: 1, subjectRole: candidate.subjectRole, entry };
}

function asRecord(value: unknown, errorMessage: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value as Record<string, unknown>;
}
