import { useState } from 'react';
import { REPORT_DETAIL_MAX_LENGTH } from '@repo/shared/social-safety/report';
import { RoommateActionConfirmationDialog } from './RoommateActionConfirmationDialog';
import {
  getReportReasonOptions,
  reportReasonLabel,
} from '../model/actions/roommateActionReasonCopy';
import type {
  RoommateActionDialogState,
  RoommateProfileReportFormValue,
} from '../hooks/useRoommateActions';
import type { ReportReason } from '@repo/shared/social-safety/report';

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
    <RoommateActionConfirmationDialog
      isOpen={target !== null}
      onClose={onClose}
      title="룸메이트 신고"
      tone="amber"
      headline={target ? `${target.nickname}님을 신고할까요?` : ''}
      noticeTitle="신고 전 알아야 할 사항"
      noticeItems={[
        '신고가 접수되면 검토 완료 시 알림으로 안내드려요.',
        '내부 검토 과정과 세부 조치 내용은 공개하지 않아요.',
        '상대에게 신고자 정보와 차단 여부를 알리지 않아요.',
        '신고 사유를 이해하는 데 필요한 내용만 작성해 주세요.',
      ]}
    >
      {target ? (
        <RoommateReportForm
          key={target.targetUserId}
          submitting={submitting}
          errorMessage={errorMessage}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </RoommateActionConfirmationDialog>
  );
}

function RoommateReportForm({
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
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
      className="space-y-5"
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
      <label className="block" htmlFor="roommate-report-reason">
        <span className="text-sm font-semibold text-(--knu-text-primary)">신고 사유</span>
        <select
          id="roommate-report-reason"
          value={reason}
          disabled={submitting}
          onChange={(event) => setReason(event.target.value as ReportReason | '')}
          className="mt-2 w-full rounded-2xl border border-(--knu-border) bg-white px-3 py-3 text-sm outline-none focus:border-(--knu-primary) disabled:opacity-60"
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
        <span className="text-sm font-semibold text-(--knu-text-primary)">상세 내용 (선택)</span>
        <textarea
          id="roommate-report-detail"
          value={detail}
          maxLength={REPORT_DETAIL_MAX_LENGTH + 1}
          disabled={submitting}
          aria-describedby="roommate-report-detail-help roommate-report-status"
          onChange={(event) => setDetail(event.target.value)}
          className="mt-2 min-h-32 w-full rounded-2xl border border-(--knu-border) px-3 py-3 text-sm outline-none focus:border-(--knu-primary) disabled:opacity-60"
          placeholder="신고 사유를 이해하는 데 필요한 내용만 적어 주세요."
        />
      </label>
      <p id="roommate-report-detail-help" className="text-xs text-(--knu-text-tertiary)">
        {trimmedDetail.length}/{REPORT_DETAIL_MAX_LENGTH}자
      </p>

      <label className="flex items-start gap-3 rounded-2xl bg-(--knu-background-alt) p-3 text-sm text-(--knu-text-secondary)">
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
        <p id="roommate-report-status" role="status" className="text-xs text-(--knu-text-tertiary)">
          선택한 사유: {reportReasonLabel(reason)}
        </p>
      ) : null}

      <div className="grid gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '신고 접수 중' : '신고 접수'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          className="rounded-2xl border border-(--knu-border) bg-white px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) disabled:cursor-not-allowed disabled:opacity-60"
        >
          취소
        </button>
      </div>
    </form>
  );
}
