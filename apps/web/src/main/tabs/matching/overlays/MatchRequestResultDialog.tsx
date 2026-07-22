'use client';

import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { RoommateActionReceiptDialogShell } from '../../roommate-list/overlays/RoommateActionReceiptDialog';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import {
  Building2,
  CheckCircle2,
  MessageCircle,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { RequestActionCompletion } from '../hooks/useMatchingActions';

export function MatchRequestResultDialog({
  celebration,
  completion,
  onCloseCelebration,
  onCloseCompletion,
}: {
  readonly celebration: string | null;
  readonly completion: RequestActionCompletion | null;
  readonly onCloseCelebration?: () => void;
  readonly onCloseCompletion?: () => void;
}) {
  if (celebration) {
    const avatarColor = getAvatarColor(celebration);
    const close = onCloseCelebration ?? (() => undefined);
    return (
      <BaseBottomSheet
        isOpen
        onClose={close}
        title="매칭 완료"
        footer={
          <button
            type="button"
            className="min-h-11 w-full rounded-2xl bg-(--knu-primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
            onClick={close}
          >
            확인
          </button>
        }
      >
        <div className="space-y-4 px-5 py-5">
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-bold text-emerald-700">룸메이트 매칭 확정</p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <span
                className={`grid h-12 w-12 place-items-center rounded-full text-base font-black ring-4 ring-white ${avatarColor.bg} ${avatarColor.text}`}
                aria-hidden
              >
                {celebration.trim().charAt(0) || '상'}
              </span>
              <div className="text-left">
                <p className="text-lg font-black text-slate-900">{celebration}님</p>
                <p className="text-xs text-slate-600">함께 지낼 룸메이트</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="matching-next-step-heading">
            <h3 id="matching-next-step-heading" className="text-sm font-black text-slate-900">
              이제 이렇게 준비해요
            </h3>
            <div className="mt-2 space-y-2">
              <ResultGuideRow
                icon={MessageCircle}
                title="생활 규칙 맞추기"
                description="채팅에서 생활 패턴과 필요한 약속을 먼저 이야기해보세요."
                tone="sky"
              />
              <ResultGuideRow
                icon={Building2}
                title="학교 홈페이지에서 호실 선택"
                description="실제 호실 선택은 학교 공식 일정에 맞춰 진행해요."
                tone="slate"
              />
            </div>
          </section>
        </div>
      </BaseBottomSheet>
    );
  }

  if (!completion) return null;
  const rejected = completion.action === 'rejectRequest';
  const close = onCloseCompletion ?? (() => undefined);
  const Icon = rejected ? XCircle : RotateCcw;
  const title = `${completion.message}`;

  return (
    <RoommateActionReceiptDialogShell
      Icon={Icon}
      title={title}
      counterpartSuffix=""
      noticeSections={[]}
      iconClassName="bg-slate-100 text-slate-600"
      borderClassName="border-slate-200"
      description={
        rejected ? '상대에게는 요청이 종료된 상태만 알려요.' : '다른 요청과 대화는 그대로 유지돼요.'
      }
      onDismiss={close}
    />
  );
}

function ResultGuideRow({
  icon: Icon,
  title,
  description,
  tone,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly tone: 'sky' | 'slate';
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          tone === 'sky' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-700'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p>
      </div>
    </div>
  );
}
