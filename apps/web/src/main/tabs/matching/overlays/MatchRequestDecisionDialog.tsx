'use client';

import { BaseBottomSheet } from '@/components/BaseBottomSheet';

export type MatchRequestDecision = 'accept' | 'reject' | 'cancel';

const content = {
  accept: {
    title: '매칭 요청을 수락할까요?',
    description:
      '수락하면 즉시 룸메이트 매칭이 확정되고, 다른 미결 요청은 시스템에서 종료될 수 있어요. 관련 대화는 정책에 따라 읽기 전용 또는 보관 상태로 바뀔 수 있어요.',
    submit: '수락하기',
  },
  reject: {
    title: '매칭 요청을 거절할까요?',
    description: '거절한 요청은 종료되며 상대에게 내부 사유는 공개되지 않아요.',
    submit: '거절하기',
  },
  cancel: {
    title: '보낸 요청을 취소할까요?',
    description: '이 요청만 종료되며 상대와의 프로필 또는 채팅 상태를 변경하지 않아요.',
    submit: '요청 취소하기',
  },
} as const;

export function MatchRequestDecisionDialog({
  decision,
  nickname,
  pending,
  onClose,
  onConfirm,
}: {
  readonly decision: MatchRequestDecision | null;
  readonly nickname: string;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  if (!decision) return null;
  const current = content[decision];
  return (
    <BaseBottomSheet
      isOpen
      onClose={pending ? () => undefined : onClose}
      title={current.title}
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
            className="min-h-11 rounded-2xl bg-(--knu-primary) px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? '처리 중…' : current.submit}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 py-6">
        <p className="font-semibold text-(--knu-text-primary)">{nickname}님의 요청</p>
        <p className="text-sm leading-6 text-(--knu-text-secondary)">{current.description}</p>
      </div>
    </BaseBottomSheet>
  );
}
