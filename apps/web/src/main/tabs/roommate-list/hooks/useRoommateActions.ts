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

export interface RoommateActionReceipt extends RoommateActionFeedback {
  readonly receiptId?: string;
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

  const handleError = useCallback(
    async (input: {
      readonly actionKind: RoommateActionKind;
      readonly error: unknown;
      readonly refreshAfterError: boolean;
      readonly closeDetailAfterError: boolean;
    }) => {
      if (isAbortError(input.error)) return;
      const safeError = isRoommateApiError(input.error)
        ? input.error
        : ({ code: 'UNKNOWN_ROOMMATE_ACTION_ERROR' } satisfies Pick<RoommateApiError, 'code'>);
      setLastError({
        actionKind: input.actionKind,
        ...formatRoommateActionError(safeError, input.actionKind),
      });
      setActiveDialog(CLOSED_DIALOG);
      activeDialogRef.current = CLOSED_DIALOG;
      if (input.closeDetailAfterError) {
        options.onCloseDetail();
      }
      if (input.refreshAfterError) {
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      }
    },
    [options],
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
          message: '목록과 관심 목록은 최신 차단 상태를 기준으로 다시 확인했어요.',
        });
        setActiveDialog(CLOSED_DIALOG);
        activeDialogRef.current = CLOSED_DIALOG;
        options.onCloseDetail();
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      } catch (error) {
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        await handleError({
          actionKind: 'block',
          error,
          refreshAfterError: true,
          closeDetailAfterError: true,
        });
      } finally {
        finishPending(target.targetUserId);
      }
    },
    [beginPending, client, finishPending, handleError, options],
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
        const optionalCopy = reportOptionalActionResultCopy(response.optionalActionResult);
        setLastError(null);
        setLastReceipt({
          actionKind: 'report',
          title: '신고를 접수했어요.',
          message: optionalCopy
            ? `${reportReasonLabel(response.report.reason)} 신고가 접수됐어요. ${optionalCopy}`
            : `${reportReasonLabel(response.report.reason)} 신고가 접수됐어요. 후속 조치 여부는 별도로 공개하지 않아요.`,
          receiptId: response.report.id,
        });
        setActiveDialog(CLOSED_DIALOG);
        activeDialogRef.current = CLOSED_DIALOG;
        if (response.optionalActionResult?.status === 'SUCCEEDED') {
          options.onCloseDetail();
          await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
        }
      } catch (error) {
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        await handleError({
          actionKind: 'report',
          error,
          refreshAfterError: false,
          closeDetailAfterError: false,
        });
      } finally {
        finishPending(target.targetUserId);
      }
    },
    [beginPending, client, finishPending, handleError, options],
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
        setLastReceipt({
          actionKind: 'matchRequest',
          ...matchRequestSuccessCopy(response.request),
          receiptId: response.request.id,
        });
        setActiveDialog(CLOSED_DIALOG);
        activeDialogRef.current = CLOSED_DIALOG;
        options.onCloseDetail();
        await Promise.allSettled([options.onRefreshSearch(), options.onRefreshBookmarks()]);
      } catch (error) {
        if (!isCurrent(pending.sequence, pending.controller, sequenceRef.current)) return;
        await handleError({
          actionKind: 'matchRequest',
          error,
          refreshAfterError: true,
          closeDetailAfterError: true,
        });
      } finally {
        finishPending(target.targetUserId);
      }
    },
    [beginPending, client, finishPending, handleError, options],
  );

  const pendingSet = useMemo(() => new Set(pendingTargetUserIds), [pendingTargetUserIds]);

  return {
    activeDialog,
    pendingTargetUserIds,
    lastError,
    lastReceipt,
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
    },
  };
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
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
