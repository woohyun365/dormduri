'use client';

import { useState } from 'react';
import { REPORT_REASONS } from '@/constants/report';
import type { ReportReason } from '@repo/shared/social-safety/report';

export function ChatReportSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { reason: ReportReason; detail: string | null }) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>('OTHER');
  const [detail, setDetail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-report-title"
      className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center"
    >
      <form
        className="w-full rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!accepted || submitting) return;
          setSubmitting(true);
          void onSubmit({ reason, detail: detail.trim() || null }).finally(() =>
            setSubmitting(false),
          );
        }}
      >
        <h2 id="chat-report-title" className="text-base font-bold">
          대화 신고
        </h2>
        <p className="mt-1 text-sm text-(--knu-text-secondary)">
          신고 내용은 운영 정책에 따라 검토됩니다.
        </p>
        <label className="mt-4 block text-sm font-semibold" htmlFor="chat-report-reason">
          신고 사유
        </label>
        <select
          id="chat-report-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as ReportReason)}
          className="mt-1 w-full rounded-xl border border-(--knu-border) p-3 text-sm"
        >
          {Object.entries(REPORT_REASONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="mt-4 block text-sm font-semibold" htmlFor="chat-report-detail">
          세부 내용 (선택)
        </label>
        <textarea
          id="chat-report-detail"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          maxLength={2000}
          className="mt-1 min-h-24 w-full rounded-xl border border-(--knu-border) p-3 text-sm"
        />
        <label className="mt-4 flex items-start gap-2 text-xs text-(--knu-text-secondary)">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5"
          />
          허위 신고 시 이용이 제한될 수 있음을 확인했어요.
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!accepted || submitting}
            className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            신고하기
          </button>
        </div>
      </form>
    </div>
  );
}
