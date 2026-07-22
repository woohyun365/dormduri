'use client';

import { useRef, useState } from 'react';
import type { CurrentActiveMatchSummary } from '@repo/shared/match/contract';
import { PairActiveMatchCard } from '../../components/pair/PairActiveMatchCard';
import { useActiveMatchProfileDetail } from '../../hooks/useActiveMatchProfileDetail';
import { toMatchingActiveView } from '../../model/matching-active-view';
import { MatchingProfileDialog } from '../../overlays/MatchingProfileDialog';
import { UnmatchDecisionDialog } from '../../overlays/UnmatchDecisionDialog';
import type { MatchingActionRunResult } from '../../hooks/useMatchingActions';

export interface MatchingActiveCommands {
  readonly requestUnmatch: (id: string) => Promise<MatchingActionRunResult> | void;
  readonly cancelUnmatchRequest: (id: string) => Promise<MatchingActionRunResult> | void;
  readonly isPending: (action: 'requestUnmatch' | 'cancelUnmatchRequest', id: string) => boolean;
}

export function ActiveMatchSection({
  activeMatch,
  readOnly,
  commands,
  actionError,
  completionMessage,
  roomSelectionDate,
  seasonEndDate,
  onDismissActionError,
  onDismissCompletion,
  onNavigateChat,
}: {
  readonly activeMatch: CurrentActiveMatchSummary;
  readonly readOnly: boolean;
  readonly commands?: MatchingActiveCommands;
  readonly actionError?: string | null;
  readonly completionMessage?: string | null;
  readonly roomSelectionDate?: string | null;
  readonly seasonEndDate?: string | null;
  readonly onDismissActionError?: () => void;
  readonly onDismissCompletion?: () => void;
  readonly onNavigateChat?: () => void;
}) {
  const view = toMatchingActiveView(activeMatch);
  const detail = useActiveMatchProfileDetail();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const decisionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const action = view.unmatch.primaryAction;
  const pending = Boolean(
    action &&
    commands?.isPending(action === 'cancel' ? 'cancelUnmatchRequest' : 'requestUnmatch', view.id),
  );

  const closeDecision = () => {
    setDecisionOpen(false);
    const trigger = decisionTriggerRef.current;
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else {
        const fallback =
          document.getElementById('matching-active-heading') ??
          document.getElementById('matching-tab-heading');
        fallback?.focus({ preventScroll: true });
      }
    });
  };

  const submitDecision = async () => {
    if (!commands || !action) return;
    const result = await (action === 'cancel'
      ? commands.cancelUnmatchRequest(view.id)
      : commands.requestUnmatch(view.id));
    if (result !== 'error') closeDecision();
  };

  return (
    <section aria-labelledby="matching-active-heading" className="mt-5 min-w-0">
      <h2 id="matching-active-heading" tabIndex={-1} className="sr-only">
        확정된 룸메이트
      </h2>
      {completionMessage ? (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span>{completionMessage}</span>
          {onDismissCompletion ? (
            <button
              type="button"
              className="min-h-11 px-3 font-semibold underline"
              onClick={onDismissCompletion}
            >
              닫기
            </button>
          ) : null}
        </div>
      ) : null}
      {actionError ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <span>{actionError}</span>
          {onDismissActionError ? (
            <button
              type="button"
              className="min-h-11 px-3 font-semibold underline"
              onClick={onDismissActionError}
            >
              닫기
            </button>
          ) : null}
        </div>
      ) : null}
      <PairActiveMatchCard
        key={`${view.id}:${view.unmatch.state}`}
        activeMatch={view}
        readOnly={readOnly}
        pending={pending}
        roomSelectionDate={roomSelectionDate}
        seasonEndDate={seasonEndDate}
        onOpenProfile={(trigger) => detail.open(view, trigger)}
        onNavigateChat={onNavigateChat}
        onUnmatchDecision={
          !readOnly && commands && action
            ? (trigger) => {
                decisionTriggerRef.current = trigger;
                setDecisionOpen(true);
              }
            : undefined
        }
      />
      <MatchingProfileDialog
        state={detail}
        title="확정된 룸메이트 프로필"
        onClose={detail.close}
        onRetry={detail.retry}
      />
      <UnmatchDecisionDialog
        unmatch={decisionOpen ? view.unmatch : null}
        nickname={view.nickname}
        pending={pending}
        errorMessage={actionError}
        onClose={closeDecision}
        onConfirm={() => void submitDecision()}
      />
    </section>
  );
}
