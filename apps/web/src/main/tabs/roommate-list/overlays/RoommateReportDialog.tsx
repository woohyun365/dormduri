import { useState } from 'react';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import {
  getReportReasonOptions,
  reportReasonLabel,
} from '../model/actions/roommateActionReasonCopy';
import type {
  RoommateActionDialogState,
  RoommateActionTargetSnapshot,
  RoommateProfileReportFormValue,
} from '../hooks/useRoommateActions';
import type { ReportReason } from '@repo/shared/social-safety/report';

const REPORT_DETAIL_MAX_LENGTH = 2000;

interface RoommateReportDialogProps {
  readonly state: RoommateActionDialogState;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: RoommateProfileReportFormValue) => void;
}

export function RoommateReportDialog({
  state,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: RoommateReportDialogProps) {
  const target = state.kind === 'report' ? state.target : null;

  return (
    <BaseBottomSheet isOpen={target !== null} onClose={onClose} title="룸메이트 신고">
      {target ? (
        <RoommateReportForm
          key={target.targetUserId}
          target={target}
          submitting={submitting}
          errorMessage={errorMessage}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </BaseBottomSheet>
  );
}

function RoommateReportForm({
  target,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  readonly target: RoommateActionTargetSnapshot;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: RoommateProfileReportFormValue) => void;
}) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [detail, setDetail] = useState('');
  const [optionalBlock, setOptionalBlock] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const trimmedDetail = detail.trim();
  const currentError = validationError ?? errorMessage ?? null;

  return (
    <form
      className="space-y-5 px-5 py-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!reason) {
          setValidationError('신고 사유를 선택해 주세요.');
          return;
        }
        if (trimmedDetail.length > REPORT_DETAIL_MAX_LENGTH) {
          setValidationError(`상세 내용은 ${REPORT_DETAIL_MAX_LENGTH}자 이하로 입력해 주세요.`);
          return;
        }
        if (!disclaimerAccepted) {
          setValidationError('허위 신고 안내를 확인해 주세요.');
          return;
        }
        setValidationError(null);
        onSubmit({ reason, detail: trimmedDetail || null, optionalBlock });
      }}
    >
      <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-4">
        <p className="text-sm font-bold text-[var(--knu-text-primary)]">
          {target.nickname}님의 프로필을 신고해요.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
          신고는 접수 전용이며, 조치 여부나 내부 검토 내용은 상대 또는 신고자에게 공개하지 않아요.
        </p>
      </section>

      <label className="block" htmlFor="roommate-report-reason">
        <span className="text-sm font-semibold text-[var(--knu-text-primary)]">신고 사유</span>
        <select
          id="roommate-report-reason"
          value={reason}
          disabled={submitting}
          onChange={(event) => setReason(event.target.value as ReportReason | '')}
          className="mt-2 w-full rounded-2xl border border-[var(--knu-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--knu-primary)] disabled:opacity-60"
        >
          <option value="">사유를 선택해 주세요</option>
          {getReportReasonOptions().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block" htmlFor="roommate-report-detail">
        <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
          상세 내용 (선택)
        </span>
        <textarea
          id="roommate-report-detail"
          value={detail}
          maxLength={REPORT_DETAIL_MAX_LENGTH + 1}
          disabled={submitting}
          aria-describedby="roommate-report-detail-help roommate-report-status"
          onChange={(event) => setDetail(event.target.value)}
          className="mt-2 min-h-32 w-full rounded-2xl border border-[var(--knu-border)] px-3 py-3 text-sm outline-none focus:border-[var(--knu-primary)] disabled:opacity-60"
          placeholder="신고 사유를 이해하는 데 필요한 내용만 적어 주세요."
        />
      </label>
      <p id="roommate-report-detail-help" className="text-xs text-[var(--knu-text-tertiary)]">
        {trimmedDetail.length}/{REPORT_DETAIL_MAX_LENGTH}자
      </p>

      <label className="flex items-start gap-3 rounded-2xl bg-[var(--knu-background-alt)] p-3 text-sm text-[var(--knu-text-secondary)]">
        <input
          type="checkbox"
          checked={optionalBlock}
          disabled={submitting}
          onChange={(event) => setOptionalBlock(event.target.checked)}
          className="mt-1"
        />
        신고 접수와 함께 이 상대를 차단하기
      </label>

      <label className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
        <input
          type="checkbox"
          checked={disclaimerAccepted}
          disabled={submitting}
          onChange={(event) => setDisclaimerAccepted(event.target.checked)}
          className="mt-1"
        />
        허위 신고는 서비스 이용 제한 대상이 될 수 있음을 확인했어요.
      </label>

      {currentError ? (
        <p id="roommate-report-status" role="alert" className="text-sm font-semibold text-red-600">
          {currentError}
        </p>
      ) : reason ? (
        <p
          id="roommate-report-status"
          role="status"
          className="text-xs text-[var(--knu-text-tertiary)]"
        >
          선택한 사유: {reportReasonLabel(reason)}
        </p>
      ) : null}

      <div className="grid gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '신고 접수 중' : '신고 접수'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          className="rounded-2xl border border-[var(--knu-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--knu-text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          취소
        </button>
      </div>
    </form>
  );
}
