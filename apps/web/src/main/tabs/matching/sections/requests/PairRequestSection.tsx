'use client';

import { useMemo, useRef, useState } from 'react';
import { List, Send, Inbox } from 'lucide-react';
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
import { PairRequestOrderControl } from '../../components/pair/PairRequestOrderControl';
import {
  orderReceivedMatchRequests,
  type MatchingReceivedRequestOrder,
} from '../../model/matching-request-ordering';

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
  initialTab,
  selectedTab,
  onSelectTab,
}: {
  readonly section: MatchingRequestSectionView;
  readonly serverNow: string;
  readonly roomSelectionDate: string | null;
  readonly commands: MatchingRequestCommands;
  readonly onOpenProfile?: (request: MatchingRequestCardView, trigger: HTMLButtonElement) => void;
  readonly initialTab?: MatchingRequestTab;
  readonly selectedTab?: MatchingRequestTab;
  readonly onSelectTab?: (tab: MatchingRequestTab) => void;
}) {
  const [localSelected, setLocalSelected] = useState<MatchingRequestTab>(
    () =>
      initialTab ??
      (section.received.some((request) => request.presentation === 'pending')
        ? 'received'
        : 'sent'),
  );
  const selected = selectedTab ?? localSelected;
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [receivedOrder, setReceivedOrder] = useState<MatchingReceivedRequestOrder>('expires-soon');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const orderedReceived = useMemo(
    () => orderReceivedMatchRequests(section.received, receivedOrder),
    [receivedOrder, section.received],
  );
  const rows = selected === 'received' ? orderedReceived : section.sent;
  const receivedPendingCount = section.received.filter(
    (request) => request.presentation === 'pending',
  ).length;

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
        trigger.focus({ preventScroll: true });
        return;
      }
      document.getElementById(`matching-requests-tab-${selected}`)?.focus({ preventScroll: true });
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
    <section aria-labelledby="matching-requests-heading" className="mt-6 min-w-0">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-5 w-1 rounded-full bg-sky-400" aria-hidden />
        <h2
          id="matching-requests-heading"
          className="flex items-center gap-2 text-lg font-bold text-(--knu-text-primary)"
        >
          <List className="h-4.5 w-4.5 text-sky-500" aria-hidden />
          요청 관리
        </h2>
      </div>
      <p className="sr-only">
        보낸 요청 {section.quota.used}/{section.quota.limit}건 사용, 남은 슬롯{' '}
        {section.quota.remaining}건
      </p>

      <div className="mb-4">
        <MatchingSegmentTabs
          selected={selected}
          onSelect={(tab) => {
            setLocalSelected(tab);
            onSelectTab?.(tab);
          }}
          quota={section.quota}
          receivedPendingCount={receivedPendingCount}
        />
      </div>

      {selected === 'received' && section.received.length > 1 ? (
        <div className="mb-3">
          <PairRequestOrderControl value={receivedOrder} onChange={setReceivedOrder} />
        </div>
      ) : null}

      <div
        id={`matching-requests-panel-${selected}`}
        role="tabpanel"
        aria-labelledby={`matching-requests-tab-${selected}`}
        tabIndex={0}
        className="min-w-0 space-y-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2"
      >
        {rows.length === 0 ? (
          <div className="py-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-(--knu-background-alt) text-(--knu-primary)">
              {selected === 'sent' ? (
                <Send className="h-5 w-5" aria-hidden />
              ) : (
                <Inbox className="h-5 w-5" aria-hidden />
              )}
            </span>
            <p className="mt-3 text-sm font-semibold text-(--knu-text-primary)">
              {selected === 'sent' ? '보낸 요청이 없어요.' : '받은 요청이 없어요.'}
            </p>
            <p className="mt-1 text-xs leading-5 text-(--knu-text-tertiary)">
              {selected === 'sent'
                ? '생활 패턴이 잘 맞는 상대를 찾아보세요.'
                : '새 요청이 오면 확인하고 응답할 수 있어요.'}
            </p>
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
