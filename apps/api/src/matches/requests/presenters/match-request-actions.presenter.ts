import type {
  MatchActionDecision,
  MatchActionDisabledReason,
  MatchRequestActions,
} from '@repo/shared/match/contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { formatKstDate } from '../../../platform/time/kst-date.js';
import { parseLifestyleOrNull } from '../../../profiles/contracts/public-profile.presenter.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import {
  isRegistrationCompleteMatchRequestParticipant,
  type MatchRequestAcceptanceParticipantPolicyInput,
} from '../policies/match-request-acceptance.policy.js';
import type { MatchRequestRecord } from '../persistence/match-request.select.js';

const notApplicable = (): MatchActionDecision => ({ allowed: false, reason: null });
const allowed = (): MatchActionDecision => ({ allowed: true, reason: null });
const denied = (reason: MatchActionDisabledReason): MatchActionDecision => ({
  allowed: false,
  reason,
});

export interface ResolveMatchRequestActionsInput {
  request: MatchRequestRecord;
  viewerParticipantId: string;
  season: CurrentSeasonContext;
  registrationSnapshotParticipantIds: ReadonlySet<string>;
  activeParticipantIds: ReadonlySet<string>;
  now: Date;
}

/**
 * request read model의 action capability를 mutation precondition에 맞춰 투영한다.
 * 수락과 달리 pending 요청의 거절/취소는 stale relation을 정리하는 cleanup action이므로
 * registration이나 season action window가 닫혀도 계속 허용한다.
 */
export function resolveMatchRequestActions(
  input: ResolveMatchRequestActionsInput,
): MatchRequestActions {
  const { request, viewerParticipantId } = input;

  if (request.status !== 'PENDING') {
    const reason = request.status === 'EXPIRED' ? 'REQUEST_EXPIRED' : 'REQUEST_ALREADY_RESOLVED';
    return {
      accept: denied(reason),
      reject: denied(reason),
      cancel: denied(reason),
    };
  }

  if (request.requesterParticipantId === viewerParticipantId) {
    return {
      accept: notApplicable(),
      reject: notApplicable(),
      cancel: allowed(),
    };
  }

  return {
    accept: resolveAcceptDecision(input),
    reject: allowed(),
    cancel: notApplicable(),
  };
}

function resolveAcceptDecision(input: ResolveMatchRequestActionsInput): MatchActionDecision {
  const { request, season, now } = input;
  const requester = toAcceptanceParticipantPolicyInput(request.requesterParticipant);
  const receiver = toAcceptanceParticipantPolicyInput(request.receiverParticipant);

  if (isCounterpartUnavailable(request.requesterParticipant)) {
    return denied('TARGET_UNAVAILABLE');
  }
  if (season.state !== 'SEASON_MATCHING') {
    return denied('SEASON_NOT_ACTIONABLE');
  }

  const operation = request.requesterParticipant.dormitoryId
    ? season.operatedDormitories.find(
        (item) => item.isOperated && item.dormitoryId === request.requesterParticipant.dormitoryId,
      )
    : null;
  if (!operation || formatKstDate(now) > operation.roomSelectionDate) {
    return denied('ROOM_SELECTION_CUTOFF');
  }

  const participantIds = [request.requesterParticipantId, request.receiverParticipantId];
  const hasBothRegistrationSnapshots = participantIds.every((participantId) =>
    input.registrationSnapshotParticipantIds.has(participantId),
  );
  const hasActiveRelation = participantIds.some((participantId) =>
    input.activeParticipantIds.has(participantId),
  );
  const sameDormitory =
    requester.dormitoryId !== null && requester.dormitoryId === receiver.dormitoryId;

  if (
    !isRegistrationCompleteMatchRequestParticipant(requester) ||
    !isRegistrationCompleteMatchRequestParticipant(receiver) ||
    !sameDormitory ||
    !hasBothRegistrationSnapshots ||
    hasActiveRelation
  ) {
    return denied('MATCH_PRECONDITION_FAILED');
  }

  return allowed();
}

function toAcceptanceParticipantPolicyInput(
  participant: MatchRequestRecord['requesterParticipant'],
): MatchRequestAcceptanceParticipantPolicyInput {
  const lifestyle = parseLifestyleOrNull(participant.profile ?? null);

  return {
    participationIntent: participant.participationIntent,
    registeredAt: participant.registeredAt,
    dormitoryId: participant.dormitoryId,
    dormitorySelectionState: participant.dormitorySelectionState,
    participantStatus: participant.participantStatus,
    declinedAt: participant.declinedAt,
    withdrawnAt: participant.withdrawnAt,
    hiddenByAdminAt: participant.hiddenByAdminAt,
    deactivatedAt: participant.deactivatedAt,
    userDeletedAt: participant.user.deletedAt,
    seasonProfileComplete: lifestyle !== null && isSeasonProfileComplete(lifestyle),
  };
}

function isCounterpartUnavailable(counterpart: MatchRequestRecord['requesterParticipant']) {
  return (
    counterpart.participantStatus === 'WITHDRAWN' ||
    counterpart.participantStatus === 'EXPIRED' ||
    counterpart.withdrawnAt !== null ||
    counterpart.hiddenByAdminAt !== null ||
    counterpart.deactivatedAt !== null ||
    counterpart.user.deletedAt !== null
  );
}
