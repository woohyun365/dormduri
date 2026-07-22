import { formatTargetActionUnavailableReason } from '../../model/actions/roommateActionReasonCopy';
import type { RoommateActionTargetSnapshot } from '../../hooks/useRoommateActions';
import type { RoommatePendingMatchRequestViewModel } from '../../model/search/roommateSearchViewModel';

export interface PendingMatchRequestDirectActions {
  readonly pending: boolean;
  readonly onAccept?: () => void;
  readonly onCancel?: () => void;
}

export function ActionSummary({
  target,
  pendingMatchRequest,
  pending,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
  pendingRequestActions,
}: {
  readonly target: RoommateActionTargetSnapshot;
  readonly pendingMatchRequest: RoommatePendingMatchRequestViewModel | null;
  readonly pending: boolean;
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
  readonly pendingRequestActions?: PendingMatchRequestDirectActions;
}) {
  const primaryUnavailableReason = target.actions.unavailableReasons[0] ?? null;
  const directionLimitReached = target.actions.unavailableReasons.includes(
    'MATCH_REQUEST_DIRECTION_LIMIT_REACHED',
  );
  const seasonRequestPreview =
    !target.actions.canRequestMatch &&
    target.actions.canStartChat &&
    target.actions.unavailableReasons.includes('SEASON_NOT_ACTIONABLE');
  const primaryButtonClass =
    'rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4">
      <div className="grid gap-2">
        {directionLimitReached ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요
          </div>
        ) : null}
        {pendingMatchRequest && pendingRequestActions ? (
          pendingMatchRequest.direction === 'RECEIVED' ? (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={pendingRequestActions.pending || !pendingRequestActions.onAccept}
                onClick={pendingRequestActions.onAccept}
                className={primaryButtonClass}
              >
                수락
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pendingRequestActions.pending || !pendingRequestActions.onCancel}
              onClick={pendingRequestActions.onCancel}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              요청 취소
            </button>
          )
        ) : pendingMatchRequest ? (
          pendingMatchRequest.direction === 'RECEIVED' && onOpenMatchingRequests ? (
            <button
              type="button"
              disabled={pending}
              onClick={onOpenMatchingRequests}
              className={primaryButtonClass}
            >
              받은 요청 확인하기
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-2xl bg-(--knu-background-alt) px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) disabled:cursor-not-allowed"
            >
              {pendingMatchRequest.direction === 'SENT'
                ? '요청 응답 대기 중'
                : '매칭 탭에서 확인할 수 있어요'}
            </button>
          )
        ) : target.actions.canRequestMatch && onRequestMatch ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRequestMatch(target)}
            className={primaryButtonClass}
          >
            {pending ? '요청 처리 중' : '매칭 요청 보내기'}
          </button>
        ) : directionLimitReached ? (
          <button
            type="button"
            disabled
            className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed"
          >
            매칭 요청 횟수 초과
          </button>
        ) : seasonRequestPreview ? (
          <button
            type="button"
            aria-disabled="true"
            className="cursor-default rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
          >
            매칭 요청 보내기
          </button>
        ) : target.actions.canStartChat && onStartChat ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onStartChat(target)}
            className={primaryButtonClass}
          >
            대화 화면에서 이어가기
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-2xl bg-(--knu-background-alt) px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) disabled:cursor-not-allowed"
          >
            {primaryUnavailableReason
              ? formatTargetActionUnavailableReason(primaryUnavailableReason)
              : '지금 가능한 주요 행동이 없어요'}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {onReport ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onReport(target)}
              className="rounded-2xl border border-(--knu-border) bg-white px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) transition-colors hover:border-amber-200 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              신고하기
            </button>
          ) : null}
          {onBlock ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onBlock(target)}
              className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              차단하기
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
