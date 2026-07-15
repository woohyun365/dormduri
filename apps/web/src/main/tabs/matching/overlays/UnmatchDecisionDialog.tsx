'use client';

import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import type { MatchingActiveUnmatchView } from '../model/matching-active-view';

export function UnmatchDecisionDialog({
  unmatch,
  nickname,
  pending,
  errorMessage,
  onClose,
  onConfirm,
}: {
  readonly unmatch: MatchingActiveUnmatchView | null;
  readonly nickname: string;
  readonly pending: boolean;
  readonly errorMessage?: string | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  if (!unmatch?.primaryAction) return null;
  const cancelling = unmatch.primaryAction === 'cancel';
  const agreeing = unmatch.state === 'WAITING_FOR_ME';
  const title = cancelling
    ? '내 매칭 해제 요청을 철회할까요?'
    : agreeing
      ? '매칭 해제에 동의할까요?'
      : '매칭 해제를 요청할까요?';
  const description = cancelling
    ? '내 동의만 철회하며 현재 매칭 관계는 그대로 유지돼요.'
    : agreeing
      ? '상대가 이미 요청했기 때문에 동의하면 두 사람의 매칭이 즉시 해제돼요.'
      : '상대도 동의해야 매칭이 해제돼요. 상대가 동의하기 전에는 현재 매칭 관계가 유지돼요.';

  return (
    <BaseBottomSheet
      isOpen
      onClose={pending ? () => undefined : onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="min-h-11 rounded-2xl border border-(--knu-border) px-4 text-sm font-semibold text-(--knu-text-secondary) disabled:opacity-50"
            disabled={pending}
            onClick={onClose}
          >
            돌아가기
          </button>
          <button
            type="button"
            className="min-h-11 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending
              ? '처리 중…'
              : cancelling
                ? '요청 철회하기'
                : agreeing
                  ? '해제 동의하기'
                  : '해제 요청하기'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 py-6">
        <p className="wrap-break-word font-semibold text-(--knu-text-primary)">
          {nickname}님과의 매칭
        </p>
        <p className="text-sm leading-6 text-(--knu-text-secondary)">{description}</p>
        {errorMessage ? (
          <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </BaseBottomSheet>
  );
}
