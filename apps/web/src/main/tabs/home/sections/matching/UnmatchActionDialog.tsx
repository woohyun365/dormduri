import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { HomeResponsiveDialog } from '../../overlays/HomeResponsiveDialog';
import { resolveUnmatchProgressHelper } from './model/matchingSummaryContent';
import type { ActiveMatchUnmatchProgress } from '@repo/shared/match/contract';

export type UnmatchDialogMode = 'request-unmatch' | 'cancel-unmatch';

export function UnmatchActionDialog({
  mode,
  progress,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: {
  mode: UnmatchDialogMode;
  progress: ActiveMatchUnmatchProgress;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isCancel = mode === 'cancel-unmatch';

  return (
    <HomeResponsiveDialog
      label={isCancel ? '매칭 해제 요청 철회' : '매칭 해제 요청'}
      icon={isCancel ? XCircle : ShieldAlert}
      eyebrow="상호 합의 해제"
      title={isCancel ? '해제 요청을 철회할까요?' : '매칭 해제를 요청할까요?'}
      description={
        isCancel
          ? '상대가 아직 요청하지 않았다면 내 해제 요청을 철회할 수 있어요.'
          : '양쪽이 모두 요청해야 매칭 해제가 완료돼요. 한쪽 요청만으로는 현재 매칭이 유지돼요.'
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          >
            {isSubmitting ? '처리 중...' : isCancel ? '요청 철회하기' : '해제 요청하기'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <p className="text-xs font-bold text-rose-700">현재 진행률</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-900">
            {progress.progressCount}/{progress.requiredCount}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-rose-700">
            {resolveUnmatchProgressHelper(progress)}
          </p>
        </div>
        <UnmatchPolicyList
          items={[
            '매칭 해제는 이번 시즌의 현재 확정 매칭만 대상으로 해요.',
            '상대가 아직 요청하지 않았다면 내 요청은 철회할 수 있어요.',
            '양쪽 요청이 모두 모이면 매칭 해제가 완료돼요.',
          ]}
        />
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </HomeResponsiveDialog>
  );
}

function UnmatchPolicyList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden={true} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
