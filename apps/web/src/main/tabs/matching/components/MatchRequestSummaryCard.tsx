'use client';

import type { MatchingRequestCardView } from '../model/matching-request-view';
import type { MatchRequestDecision } from '../overlays/MatchRequestDecisionDialog';
import { MatchStatusBadge } from './MatchStatusBadge';
import { RequestExpiryText } from './RequestExpiryText';

export function MatchRequestSummaryCard({
  request,
  serverNow,
  roomSelectionDate,
  pending,
  onDecision,
  onOpenProfile,
  onNavigateChat,
}: {
  readonly request: MatchingRequestCardView;
  readonly serverNow: string;
  readonly roomSelectionDate: string | null;
  readonly pending: boolean;
  readonly onDecision: (decision: MatchRequestDecision, trigger: HTMLButtonElement) => void;
  readonly onOpenProfile?: (request: MatchingRequestCardView, trigger: HTMLButtonElement) => void;
  readonly onNavigateChat?: () => void;
}) {
  const terminal = request.presentation === 'terminal';
  const descriptionId = request.actions.disabledReasonDescriptionId ?? undefined;
  const actionClass =
    'min-h-11 rounded-xl px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <article className="min-w-0 rounded-2xl border border-(--knu-border) bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-(--knu-text-primary)">
            {request.nickname}
          </h3>
          {request.intro ? (
            <p className="mt-1 break-words text-sm leading-6 text-(--knu-text-secondary)">
              {request.intro}
            </p>
          ) : null}
        </div>
        <MatchStatusBadge label={request.statusLabel} terminal={terminal} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {request.score !== null ? (
          <span className="rounded-full bg-(--knu-primary)/10 px-2.5 py-1 font-semibold text-(--knu-primary)">
            매칭도 {request.score}점
          </span>
        ) : (
          <span className="text-xs text-(--knu-text-tertiary)">{request.scoreHiddenCopy}</span>
        )}
        {request.canStartChat ? (
          <span className="rounded-full bg-(--knu-background-alt) px-2.5 py-1 text-xs font-medium text-(--knu-text-secondary)">
            채팅 가능
          </span>
        ) : null}
      </div>

      {request.note ? (
        <div className="mt-3 rounded-xl bg-(--knu-background-alt) p-3">
          <p className="text-xs font-semibold text-(--knu-text-secondary)">함께 보낸 메모</p>
          <p className="mt-1 break-words text-sm leading-6 text-(--knu-text-primary)">
            {request.note}
          </p>
        </div>
      ) : null}

      {request.presentation === 'pending' ? (
        <div className="mt-3">
          <RequestExpiryText
            serverNow={serverNow}
            expiresAt={request.expiresAt}
            roomSelectionDate={roomSelectionDate}
          />
        </div>
      ) : null}

      {request.actions.disabledReasonCopy ? (
        <p
          id={descriptionId}
          className="mt-3 break-words rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
        >
          {request.actions.disabledReasonCopy}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {request.canStartChat && onNavigateChat ? (
          <button
            type="button"
            className={`${actionClass} border border-(--knu-border) text-(--knu-text-secondary)`}
            onClick={onNavigateChat}
          >
            채팅하기
          </button>
        ) : null}
        {request.detailEntryToken && onOpenProfile ? (
          <button
            type="button"
            className={`${actionClass} border border-(--knu-border) text-(--knu-text-secondary)`}
            onClick={(event) => onOpenProfile(request, event.currentTarget)}
          >
            {request.nickname} 프로필 상세 보기
          </button>
        ) : null}

        {!terminal && request.direction === 'SENT' ? (
          <button
            type="button"
            className={`${actionClass} border border-(--knu-border) text-(--knu-text-secondary)`}
            disabled={pending || !request.actions.canCancel}
            aria-describedby={descriptionId}
            onClick={(event) => onDecision('cancel', event.currentTarget)}
          >
            요청 취소
          </button>
        ) : null}

        {!terminal && request.direction === 'RECEIVED' ? (
          <>
            <button
              type="button"
              className={`${actionClass} border border-(--knu-border) text-(--knu-text-secondary)`}
              disabled={pending || !request.actions.canReject}
              aria-describedby={descriptionId}
              onClick={(event) => onDecision('reject', event.currentTarget)}
            >
              거절
            </button>
            <button
              type="button"
              className={`${actionClass} bg-(--knu-primary) text-white`}
              disabled={pending || !request.actions.canAccept}
              aria-describedby={descriptionId}
              onClick={(event) => onDecision('accept', event.currentTarget)}
            >
              수락
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
