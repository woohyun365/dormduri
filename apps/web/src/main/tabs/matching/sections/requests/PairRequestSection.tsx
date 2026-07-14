'use client';

import { useRef, useState } from 'react';
import { MatchRequestSummaryCard } from '../../components/MatchRequestSummaryCard';
import { MatchingSegmentTabs, type MatchingRequestTab } from '../../components/MatchingSegmentTabs';
import type {
  MatchingRequestCardView,
  MatchingRequestSectionView,
} from '../../model/matching-request-view';
import {
  MatchRequestDecisionDialog,
  type MatchRequestDecision,
} from '../../overlays/MatchRequestDecisionDialog';

export type MatchingRequestCommandResult = 'success' | 'state-changed' | 'error' | 'aborted';

export interface MatchingRequestCommands {
  readonly accept: (id: string) => Promise<MatchingRequestCommandResult> | void;
  readonly reject: (id: string) => Promise<MatchingRequestCommandResult> | void;
  readonly cancel: (id: string) => Promise<MatchingRequestCommandResult> | void;
  readonly isPending: (
    action: 'acceptRequest' | 'rejectRequest' | 'cancelRequest',
    id: string,
  ) => boolean;
}

interface DialogState {
  readonly decision: MatchRequestDecision;
  readonly request: MatchingRequestCardView;
}

export function PairRequestSection({
  section,
  serverNow,
  roomSelectionDate,
  commands,
  onOpenProfile,
  onNavigateChat,
  initialTab,
}: {
  readonly section: MatchingRequestSectionView;
  readonly serverNow: string;
  readonly roomSelectionDate: string | null;
  readonly commands: MatchingRequestCommands;
  readonly onOpenProfile?: (request: MatchingRequestCardView, trigger: HTMLButtonElement) => void;
  readonly onNavigateChat?: () => void;
  readonly initialTab?: MatchingRequestTab;
}) {
  const [selected, setSelected] = useState<MatchingRequestTab>(
    () =>
      initialTab ??
      (section.received.some((request) => request.presentation === 'pending')
        ? 'received'
        : 'sent'),
  );
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rows = selected === 'received' ? section.received : section.sent;

  const actionName = dialog
    ? dialog.decision === 'accept'
      ? 'acceptRequest'
      : dialog.decision === 'reject'
        ? 'rejectRequest'
        : 'cancelRequest'
    : null;
  const pending = dialog && actionName ? commands.isPending(actionName, dialog.request.id) : false;

  const restoreFocus = () => {
    const trigger = triggerRef.current;
    queueMicrotask(() => {
      if (trigger?.isConnected) {
        trigger.focus();
        return;
      }
      document.getElementById(`matching-requests-tab-${selected}`)?.focus();
    });
  };

  const closeDialog = () => {
    setDialog(null);
    restoreFocus();
  };

  const submit = async () => {
    if (!dialog) return;
    const command = commands[dialog.decision];
    const result = await command(dialog.request.id);
    if (result !== 'error') closeDialog();
  };

  return (
    <section aria-labelledby="matching-requests-heading" className="mt-5 min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="matching-requests-heading"
            className="text-lg font-bold text-(--knu-text-primary)"
          >
            매칭 요청
          </h2>
          <p className="mt-1 text-sm text-(--knu-text-secondary)">
            보낸 요청 {section.quota.used}/{section.quota.limit}건 사용 · 남은 슬롯{' '}
            {section.quota.remaining}건
          </p>
        </div>
      </div>

      <MatchingSegmentTabs
        selected={selected}
        onSelect={setSelected}
        counts={{ received: section.received.length, sent: section.sent.length }}
      />

      <div
        id={`matching-requests-panel-${selected}`}
        role="tabpanel"
        aria-labelledby={`matching-requests-tab-${selected}`}
        tabIndex={0}
        className="mt-4 min-w-0 space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2"
      >
        {rows.length === 0 ? (
          <div className="rounded-2xl bg-(--knu-background-alt) p-5 text-sm leading-6 text-(--knu-text-secondary)">
            {selected === 'sent' ? '아직 보낸 요청이 없어요.' : '아직 받은 요청이 없어요.'}
          </div>
        ) : (
          rows.map((request) => {
            const requestPending =
              commands.isPending('acceptRequest', request.id) ||
              commands.isPending('rejectRequest', request.id) ||
              commands.isPending('cancelRequest', request.id);
            return (
              <MatchRequestSummaryCard
                key={request.id}
                request={request}
                serverNow={serverNow}
                roomSelectionDate={roomSelectionDate}
                pending={requestPending}
                onOpenProfile={onOpenProfile}
                onNavigateChat={onNavigateChat}
                onDecision={(decision, trigger) => {
                  triggerRef.current = trigger;
                  setDialog({ decision, request });
                }}
              />
            );
          })
        )}
      </div>

      <MatchRequestDecisionDialog
        decision={dialog?.decision ?? null}
        nickname={dialog?.request.nickname ?? ''}
        pending={Boolean(pending)}
        onClose={closeDialog}
        onConfirm={() => void submit()}
      />
    </section>
  );
}
