'use client';

import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { CheckCircle2, RotateCcw, XCircle, type LucideIcon } from 'lucide-react';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';

export type MatchRequestDecision = 'accept' | 'reject' | 'cancel';

const content = {
  accept: {
    title: '매칭 요청을 수락할까요?',
    eyebrow: '매칭 확정',
    noticeTitle: '매칭 전 알아야 할 사항',
    noticeItems: [
      '두 사람의 룸메이트 매칭이 바로 확정돼요.',
      '다른 유저와의 매칭 요청·채팅은 자동으로 종료돼요.',
      '매칭된 룸메와의 대화는 시즌 종료 시까지 유지돼요.',
      '실제 호실 선택은 학교 홈페이지를 통해 진행해요.',
    ],
    submit: '수락하기',
    Icon: CheckCircle2,
    card: 'border-indigo-100 bg-indigo-50/70',
    accent: 'bg-indigo-100 text-indigo-700',
    submitClassName: 'bg-(--knu-primary) text-white hover:bg-blue-700',
  },
  reject: {
    title: '매칭 요청을 거절할까요?',
    eyebrow: '요청 종료',
    noticeTitle: '매칭 거절 전 알아야 할 사항',
    noticeItems: [
      '이 요청만 종료되고 상대에게 요청을 다시 받을 수 있어요.',
      '매칭도 비교 결과와 채팅은 그대로 유지돼요.',
      '상대에게 거절 의사를 전달할 수 있어요.',
    ],
    submit: '거절하기',
    Icon: XCircle,
    card: 'border-slate-200 bg-slate-50',
    accent: 'bg-slate-200 text-slate-700',
    submitClassName: 'bg-slate-800 text-white hover:bg-slate-700',
  },
  cancel: {
    title: '보낸 요청을 취소할까요?',
    eyebrow: '요청 취소',
    noticeTitle: '매칭 취소 전 알아야 할 사항',
    noticeItems: [
      '이 요청만 종료되고 상대에게 요청을 다시 보낼 수 있어요.',
      '매칭도 비교 결과와 채팅은 그대로 유지돼요.',
      '괴롭힘 방지를 위해 동일한 상대에게 일정 횟수 이상의 요청은 제한돼요.',
    ],
    submit: '요청 취소하기',
    Icon: RotateCcw,
    card: 'border-slate-200 bg-slate-50',
    accent: 'bg-slate-200 text-slate-700',
    submitClassName: 'bg-slate-800 text-white hover:bg-slate-700',
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
  const avatarColor = getAvatarColor(nickname);
  const Icon = current.Icon as LucideIcon;
  return (
    <BaseBottomSheet
      isOpen
      layer="nested"
      onClose={pending ? () => undefined : onClose}
      title={current.title}
      footer={
        <div className="grid gap-2 min-[361px]:grid-cols-2 min-[361px]:gap-3">
          <button
            type="button"
            className="min-h-11 rounded-2xl border border-(--knu-border) px-4 text-sm font-semibold text-(--knu-text-secondary) transition-colors hover:bg-slate-50 disabled:opacity-50"
            disabled={pending}
            onClick={onClose}
          >
            돌아가기
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-2xl px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${current.submitClassName}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? '처리 중…' : current.submit}
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-5">
        <section className={`rounded-3xl border p-4 ${current.card}`}>
          <div className="flex items-center gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black ${avatarColor.bg} ${avatarColor.text}`}
              aria-hidden
            >
              {nickname.trim().charAt(0) || '상'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-(--knu-text-tertiary)">{current.eyebrow}</p>
              <p className="mt-0.5 truncate text-base font-black text-(--knu-text-primary)">
                {nickname}님
              </p>
            </div>
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${current.accent}`}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
          </div>
          <p className="mt-4 text-xs font-bold text-(--knu-text-primary)">{current.noticeTitle}</p>
          <ul className="mt-2 space-y-2">
            {current.noticeItems.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-5 text-(--knu-text-secondary)">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BaseBottomSheet>
  );
}
