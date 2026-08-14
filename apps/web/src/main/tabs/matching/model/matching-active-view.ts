import type {
  CurrentActiveMatchSummary,
  MatchActionDisabledReason,
} from '@repo/shared/match/contract';
import {
  getDisabledReasonDescriptionId,
  matchActionDisabledReasonCopy,
} from './matching-action-capability';

export type MatchingUnmatchConsentOwner = 'none' | 'viewer' | 'counterpart' | 'completed';
export type MatchingUnmatchPrimaryAction = 'request' | 'cancel' | null;

export interface MatchingActiveUnmatchView {
  readonly state: CurrentActiveMatchSummary['unmatchProgress']['state'];
  readonly progressText: string;
  readonly statusCopy: string;
  readonly consentOwner: MatchingUnmatchConsentOwner;
  readonly primaryAction: MatchingUnmatchPrimaryAction;
  readonly primaryActionLabel: string | null;
  readonly disabledReason: MatchActionDisabledReason | null;
  readonly disabledReasonCopy: string | null;
  readonly disabledReasonDescriptionId: string | null;
  readonly availableUntil: string | null;
}

export interface MatchingActiveView {
  readonly id: string;
  readonly counterpartUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly startedAt: string;
  readonly score: number | null;
  readonly scoreState: 'visible' | 'hidden' | 'unavailable';
  readonly canOpenProfile: boolean;
  readonly canStartChat: boolean;
  readonly unmatch: MatchingActiveUnmatchView;
}

export function toMatchingActiveView(activeMatch: CurrentActiveMatchSummary): MatchingActiveView {
  const summary = activeMatch.counterpartSummary;
  const scoreVisible =
    summary?.exposure.scoreVisible === true &&
    typeof summary.matchScore === 'number' &&
    summary.matchScore === activeMatch.matchScore;
  const canOpenProfile =
    summary?.relation.type === 'MATCHED_PARTNER' &&
    summary.exposure.detailViewable &&
    summary.resultRead.resultReadable &&
    summary.resultRead.context === 'CURRENT_MATCHED_PARTNER';
  const canStartChat =
    summary?.relation.type === 'MATCHED_PARTNER' && summary.actions.canStartChat === true;

  return {
    id: activeMatch.id,
    counterpartUserId: activeMatch.counterpartUserId,
    nickname:
      activeMatch.counterpartNickname ?? summary?.profileSummary.nickname ?? '매칭된 사용자',
    intro: summary?.profileSummary.intro || null,
    startedAt: activeMatch.startedAt,
    score: scoreVisible ? activeMatch.matchScore! : null,
    scoreState: scoreVisible ? 'visible' : summary ? 'hidden' : 'unavailable',
    canOpenProfile,
    canStartChat,
    unmatch: toUnmatchView(activeMatch),
  };
}

function toUnmatchView(activeMatch: CurrentActiveMatchSummary): MatchingActiveUnmatchView {
  const progress = activeMatch.unmatchProgress;
  const presentation = (() => {
    switch (progress.state) {
      case 'NONE':
        return {
          statusCopy: '아직 매칭 해제에 동의한 사람이 없어요.',
          consentOwner: 'none' as const,
        };
      case 'WAITING_FOR_COUNTERPART':
        return {
          statusCopy: '내가 해제를 요청했고 상대의 동의를 기다리고 있어요.',
          consentOwner: 'counterpart' as const,
        };
      case 'WAITING_FOR_ME':
        return {
          statusCopy: '상대가 해제를 요청했어요. 내가 동의하면 즉시 해제돼요.',
          consentOwner: 'viewer' as const,
        };
      case 'COMPLETED':
        return {
          statusCopy: '두 사람 모두 동의해 매칭이 해제되었어요.',
          consentOwner: 'completed' as const,
        };
    }
  })();
  const primaryAction: MatchingUnmatchPrimaryAction = progress.canCancel
    ? 'cancel'
    : progress.canRequest
      ? 'request'
      : null;
  const disabledReason = primaryAction ? null : progress.disabledReason;

  return {
    state: progress.state,
    progressText: `${progress.progressCount}/${progress.requiredCount}`,
    ...presentation,
    primaryAction,
    primaryActionLabel:
      primaryAction === 'cancel'
        ? '내 해제 요청 철회'
        : primaryAction === 'request'
          ? progress.state === 'WAITING_FOR_ME'
            ? '매칭 해제에 동의'
            : '매칭 해제 요청'
          : null,
    disabledReason,
    disabledReasonCopy: disabledReason ? matchActionDisabledReasonCopy(disabledReason) : null,
    disabledReasonDescriptionId: disabledReason
      ? getDisabledReasonDescriptionId({ actionId: activeMatch.id, reason: disabledReason })
      : null,
    availableUntil: progress.availableUntil,
  };
}
