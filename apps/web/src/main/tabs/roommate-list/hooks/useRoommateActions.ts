'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createRoommateBlock,
  createRoommateMatchRequest,
  createRoommateReport,
} from '../api/roommateActions.client';
import { isRoommateApiError, type RoommateApiError } from '../api/roommateSearch.client';
import {
  formatRoommateActionError,
  matchRequestSuccessCopy,
  reportOptionalActionResultCopy,
  reportReasonLabel,
  type RoommateActionKind,
} from '../model/actions/roommateActionReasonCopy';
import type { PublicProfileActionCapabilities } from '@repo/shared/profile/contract';
import type { CreateBlockRequest, CreateBlockResponse } from '@repo/shared/social-safety/block';
import type {
  CreateReportRequest,
  CreateReportResponse,
  ReportReason,
} from '@repo/shared/social-safety/report';
import type {
  CreateMatchRequestRequest,
  MatchRequestActionResponse,
} from '@repo/shared/match/contract';

export interface RoommateActionTargetSnapshot {
  readonly targetUserId: string;
  readonly nickname: string;
  readonly actions: PublicProfileActionCapabilities;
}

export type RoommateActionDialogState =
  | { readonly kind: 'closed'; readonly target: null }
  | { readonly kind: 'block'; readonly target: RoommateActionTargetSnapshot }
  | { readonly kind: 'report'; readonly target: RoommateActionTargetSnapshot }
  | { readonly kind: 'matchRequest'; readonly target: RoommateActionTargetSnapshot };

export interface RoommateProfileReportFormValue {
  readonly reason: ReportReason;
  readonly detail?: string | null;
  readonly optionalBlock?: boolean;
}

export interface RoommateActionFeedback {
  readonly actionKind: RoommateActionKind;
  readonly title: string;
  readonly message: string;
}

export interface RoommateActionReceiptNotice {
  readonly title: string;
  readonly message: string;
}

export interface RoommateActionReceipt extends RoommateActionFeedback {
  readonly receiptId?: string;
  readonly counterpartNickname?: string;
  readonly secondaryNotice?: RoommateActionReceiptNotice;
}

export interface RoommateActionsClientPort {
  readonly createRoommateBlock: (
    targetUserId: string,
    body: CreateBlockRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<CreateBlockResponse>;
  readonly createRoommateReport: (
    body: CreateReportRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<CreateReportResponse>;
  readonly createRoommateMatchRequest: (
    body: CreateMatchRequestRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<MatchRequestActionResponse>;
}

export interface UseRoommateActionsOptions {
  readonly client?: RoommateActionsClientPort;
  readonly onRefreshSearch: () => Promise<void>;
  readonly onRefreshBookmarks: () => Promise<void>;
  readonly onRefreshDetail: () => Promise<void>;
  readonly onCloseDetail: () => void;
}

export interface UseRoommateActionsResult {
  readonly activeDialog: RoommateActionDialogState;
  readonly pendingTargetUserIds: readonly string[];
  readonly lastError: RoommateActionFeedback | null;
  readonly lastReceipt: RoommateActionReceipt | null;
  readonly dialogError: RoommateActionFeedback | null;
  readonly isTargetPending: (targetUserId: string) => boolean;
  readonly openBlockDialog: (target: RoommateActionTargetSnapshot) => void;
  readonly openReportDialog: (target: RoommateActionTargetSnapshot) => void;
  readonly openMatchRequestDialog: (target: RoommateActionTargetSnapshot) => void;
  readonly closeDialog: () => void;
  readonly submitBlock: (input: { readonly note?: string | null }) => Promise<void>;
  readonly submitReport: (input: RoommateProfileReportFormValue) => Promise<void>;
  readonly submitMatchRequest: (input: { readonly note?: string | null }) => Promise<void>;
  readonly dismissFeedback: () => void;
}

const CLOSED_DIALOG: RoommateActionDialogState = { kind: 'closed', target: null };

const defaultClient: RoommateActionsClientPort = {
  createRoommateBlock,
  createRoommateReport,
  createRoommateMatchRequest,
};

export function useRoommateActions(options: UseRoommateActionsOptions): UseRoommateActionsResult {
  const client = options.client ?? defaultClient;
  const [activeDialog, setActiveDialog] = useState<RoommateActionDialogState>(CLOSED_DIALOG);
  const activeDialogRef = useRef<RoommateActionDialogState>(CLOSED_DIALOG);
  const [pendingTargetUserIds, setPendingTargetUserIds] = useState<readonly string[]>([]);
  const pendingRef = useRef(new Set<string>());
  const [lastError, setLastError] = useState<RoommateActionFeedback | null>(null);
  const [lastReceipt, setLastReceipt] = useState<RoommateActionReceipt | null>(null);
  const [dialogError, setDialogError] = useState<RoommateActionFeedback | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    activeDialogRef.current = activeDialog;
  }, [activeDialog]);

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
      pending.clear();
    };
  }, []);

  const syncPending = useCallback(() => {
    setPendingTargetUserIds([...pendingRef.current]);
  }, []);

  const openDialog = useCallback(
    (dialog: Exclude<RoommateActionDialogState, { kind: 'closed' }>) => {
      setLastError(null);
      setDialogError(null);
      setActiveDialog(dialog);
      activeDialogRef.current = dialog;
    },
    [],
  );

  const closeDialog = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveDialog(CLOSED_DIALOG);
    activeDialogRef.current = CLOSED_DIALOG;
    setDialogError(null);
  }, []);

  const beginPending = useCallback(
    (targetUserId: string): { sequence: number; controller: AbortController } | null => {
      if (pendingRef.current.has(targetUserId)) return null;
      pendingRef.current.add(targetUserId);
      syncPending();
      const controller = new AbortController();
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      abortRef.current = controller;
      return { sequence, controller };
    },
    [syncPending],
  );

  const finishPending = useCallback(
    (targetUserId: string) => {
      pendingRef.current.delete(targetUserId);
      syncPending();
    },
    [syncPending],
  );

  const submitBlock = useCallback(
    async (input: { readonly note?: string | null }) => {
      const dialog = activeDialogRef.current;
      if (dialog.kind !== 'block') return;
      const target = dialog.target;
      const pending = beginPending(target.targetUserId);
      if (!pending) return;
      try {
        await client.createRoommateBlock(
          target.targetUserId,
          { note: normalizeNullableText(input.note) },
          { signal: pending.controller.signal },
        );
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        setLastError(null);
        setLastReceipt({
          actionKind: 'block',
          title: '차단을 반영했어요.',
          message: '상대에게 차단 사실을 알리지 않아요.\n차단 목록에서 확인 및 해제 가능해요.',
          counterpartNickname: target.nickname,
        });
        setActiveDialog(CLOSED_DIALOG);
        activeDialogRef.current = CLOSED_DIALOG;
        options.onCloseDetail();
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      } catch (error) {
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        if (isAbortError(error)) return;
        const safeError = isRoommateApiError(error)
          ? error
          : ({ code: 'UNKNOWN_ROOMMATE_ACTION_ERROR' } satisfies Pick<RoommateApiError, 'code'>);
        setLastError(null);
        setDialogError({
          actionKind: 'block',
          ...formatRoommateActionError(safeError, 'block'),
        });
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      } finally {
        finishPending(target.targetUserId);
      }
    },
    [beginPending, client, finishPending, options],
  );

  const submitReport = useCallback(
    async (input: RoommateProfileReportFormValue) => {
      const dialog = activeDialogRef.current;
      if (dialog.kind !== 'report') return;
      const target = dialog.target;
      const pending = beginPending(target.targetUserId);
      if (!pending) return;
      try {
        const response = await client.createRoommateReport(
          {
            targetType: 'PROFILE',
            targetId: target.targetUserId,
            reason: input.reason,
            detail: normalizeNullableText(input.detail),
            evidenceAttachmentIds: [],
            optionalAction: input.optionalBlock === true ? 'BLOCK_TARGET' : null,
            falseReportDisclaimerAccepted: true,
          },
          { signal: pending.controller.signal },
        );
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        setLastError(null);
        setLastReceipt({
          actionKind: 'report',
          title: '신고를 접수했어요.',
          message: buildReportReceiptMessage(response),
          receiptId: response.report.id,
          counterpartNickname: target.nickname,
          secondaryNotice: buildReportOptionalBlockNotice(response),
        });
        setActiveDialog(CLOSED_DIALOG);
        activeDialogRef.current = CLOSED_DIALOG;
        options.onCloseDetail();
        if (response.optionalActionResult?.status === 'SUCCEEDED') {
          await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
        }
      } catch (error) {
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        if (isAbortError(error)) return;
        const safeError = isRoommateApiError(error)
          ? error
          : ({ code: 'UNKNOWN_ROOMMATE_ACTION_ERROR' } satisfies Pick<RoommateApiError, 'code'>);
        setLastError(null);
        setDialogError({
          actionKind: 'report',
          ...formatRoommateActionError(safeError, 'report'),
        });
      } finally {
        finishPending(target.targetUserId);
      }
    },
    [beginPending, client, finishPending, options],
  );

  const submitMatchRequest = useCallback(
    async (input: { readonly note?: string | null }) => {
      const dialog = activeDialogRef.current;
      if (dialog.kind !== 'matchRequest') return;
      const target = dialog.target;
      const pending = beginPending(target.targetUserId);
      if (!pending) return;
      try {
        const response = await client.createRoommateMatchRequest(
          {
            targetUserId: target.targetUserId,
            note: normalizeNullableText(input.note),
          },
          { signal: pending.controller.signal },
        );
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        setLastError(null);
        setDialogError(null);
        setLastReceipt({
          actionKind: 'matchRequest',
          ...matchRequestSuccessCopy(response.request),
          receiptId: response.request.id,
          counterpartNickname: response.request.counterpartSummary.profileSummary.nickname,
        });
        setActiveDialog(CLOSED_DIALOG);
        activeDialogRef.current = CLOSED_DIALOG;
        options.onCloseDetail();
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      } catch (error) {
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        if (isAbortError(error)) return;
        const safeError = isRoommateApiError(error)
          ? error
          : ({ code: 'UNKNOWN_ROOMMATE_ACTION_ERROR' } satisfies Pick<RoommateApiError, 'code'>);
        setLastError(null);
        setDialogError({
          actionKind: 'matchRequest',
          ...formatRoommateActionError(safeError, 'matchRequest'),
        });
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      } finally {
        finishPending(target.targetUserId);
      }
    },
    [beginPending, client, finishPending, options],
  );

  const pendingSet = useMemo(() => new Set(pendingTargetUserIds), [pendingTargetUserIds]);

  return {
    activeDialog,
    pendingTargetUserIds,
    lastError,
    lastReceipt,
    dialogError,
    isTargetPending: (targetUserId: string) => pendingSet.has(targetUserId),
    openBlockDialog: (target) => openDialog({ kind: 'block', target }),
    openReportDialog: (target) => openDialog({ kind: 'report', target }),
    openMatchRequestDialog: (target) => openDialog({ kind: 'matchRequest', target }),
    closeDialog,
    submitBlock,
    submitReport,
    submitMatchRequest,
    dismissFeedback: () => {
      setLastError(null);
      setLastReceipt(null);
      setDialogError(null);
    },
  };
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function buildReportReceiptMessage(response: CreateReportResponse): string {
  const lines = [`${reportReasonLabel(response.report.reason)} 신고가 접수됐어요.`];
  const optionalCopy = reportOptionalActionResultCopy(response.optionalActionResult);

  if (optionalCopy && response.optionalActionResult?.status !== 'SUCCEEDED') {
    lines.push(optionalCopy);
  }

  lines.push('검토가 완료되면 알림으로 안내드려요.');
  lines.push('내부 검토 과정과 세부 조치 내용은 공개하지 않아요.');
  return lines.join('\n');
}

function buildReportOptionalBlockNotice(
  response: CreateReportResponse,
): RoommateActionReceiptNotice | undefined {
  if (response.optionalActionResult?.status !== 'SUCCEEDED') return undefined;

  return {
    title: '차단 후 알아야 할 사항',
    message:
      '신고와 함께 차단도 반영했어요.\n상대에게 차단 사실을 알리지 않아요.\n차단 목록에서 확인 및 해제 가능해요.',
  };
}

function isCurrent(
  sequence: number,
  controller: AbortController,
  currentSequence: number,
): boolean {
  return currentSequence === sequence && !controller.signal.aborted;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
