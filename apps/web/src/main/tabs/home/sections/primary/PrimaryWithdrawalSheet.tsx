'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { HomeResponsiveSheet } from '../../overlays/HomeResponsiveSheet';

interface PrimaryWithdrawalSheetProps {
  onDeregisterSeasonParticipation?: () => Promise<void>;
  onClose: () => void;
}

export function PrimaryWithdrawalSheet({
  onDeregisterSeasonParticipation,
  onClose,
}: PrimaryWithdrawalSheetProps) {
  const [isSubmitting, setSubmitting] = useState(false);
  const canSubmit = Boolean(onDeregisterSeasonParticipation);

  const handleDeregister = async () => {
    if (!onDeregisterSeasonParticipation) return;

    setSubmitting(true);
    let shouldClose = false;
    try {
      await onDeregisterSeasonParticipation();
      shouldClose = true;
    } catch {
      // Parent action owns the user-facing error toast; keep the sheet open for retry.
    } finally {
      setSubmitting(false);
    }

    if (shouldClose) onClose();
  };

  return (
    <HomeResponsiveSheet
      eyebrow="시즌 참여"
      title="시즌 참여 철회"
      description="철회 전 이번 시즌 참여 상태와 매칭 활동에 미치는 영향을 확인해주세요."
      icon={XCircle}
      label="시즌 참여 철회"
      backdropLabel="시즌 참여 철회 닫기"
      onClose={onClose}
      tone="amber"
      footer={
        <>
          <button
            type="button"
            onClick={handleDeregister}
            disabled={!canSubmit || isSubmitting}
            className="min-h-11 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '처리 중...' : '시즌 참여 철회하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
          >
            닫기
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          철회하면 이번 시즌 참여자 풀에서 빠지고 같은 시즌에는 다시 참여할 수 없어요.
        </div>
        <dl className="space-y-2">
          <DetailRow label="현재 상태" value="시즌 참여 완료" />
          <DetailRow label="적용 시즌" value="현재 시즌" />
          <DetailRow label="재참여" value="같은 시즌 재참여 불가" />
        </dl>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-(--knu-text-secondary)">
          진행 중인 요청과 비매칭 대화는 철회 상태로 정리돼요. 이미 확정된 매칭이 있으면 사용자가
          직접 철회할 수 없고 별도 안내가 필요해요.
        </div>
      </div>
    </HomeResponsiveSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-bold text-(--knu-text-tertiary)">{label}</dt>
      <dd className="text-right text-sm font-bold text-(--knu-text-primary)">{value}</dd>
    </div>
  );
}
