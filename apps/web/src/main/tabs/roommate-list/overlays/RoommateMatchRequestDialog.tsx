import { useState } from 'react';
import { RoommateActionConfirmationDialog } from './RoommateActionConfirmationDialog';
import type {
  RoommateActionDialogState,
  RoommateActionTargetSnapshot,
} from '../hooks/useRoommateActions';
import {
  ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE,
  formatTargetActionUnavailableReason,
} from '../model/actions/roommateActionReasonCopy';

const MATCH_REQUEST_NOTE_MAX_LENGTH = 100;

interface RoommateMatchRequestDialogProps {
  readonly state: RoommateActionDialogState;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: { readonly note?: string | null }) => void;
}

export function RoommateMatchRequestDialog({
  state,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: RoommateMatchRequestDialogProps) {
  const target = state.kind === 'matchRequest' ? state.target : null;

  return (
    <RoommateActionConfirmationDialog
      isOpen={target !== null}
      onClose={onClose}
      title="매칭 요청 보내기"
      tone="indigo"
      headline={target ? `${target.nickname}님에게 매칭 요청을 보낼까요?` : ''}
      noticeTitle="매칭 요청 전 알아야 할 사항"
      noticeItems={[
        '요청은 최대 5일 동안 유효해요.',
        '상대가 수락하면 바로 매칭이 확정돼요.',
        '보낸 요청은 매칭 탭에서 상태를 확인할 수 있어요.',
      ]}
    >
      {target ? (
        <RoommateMatchRequestForm
          key={target.targetUserId}
          target={target}
          submitting={submitting}
          errorMessage={errorMessage}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </RoommateActionConfirmationDialog>
  );
}

function RoommateMatchRequestForm({
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
  readonly onSubmit: (input: { readonly note?: string | null }) => void;
}) {
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const trimmedNote = note.trim();
  const requestBlocked = !target.actions.canRequestMatch;
  const blockedReason = requestBlocked ? (target.actions.unavailableReasons[0] ?? null) : null;
  const blockedMessage = requestBlocked
    ? blockedReason
      ? formatTargetActionUnavailableReason(blockedReason)
      : '현재 상태에서는 매칭 요청을 보낼 수 없어요.'
    : null;
  const currentError = validationError ?? errorMessage ?? null;
  const noteDescriptionId = currentError
    ? 'roommate-match-request-note-count roommate-match-request-status'
    : 'roommate-match-request-note-count';

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (blockedMessage) {
          return;
        }
        if (trimmedNote.length > MATCH_REQUEST_NOTE_MAX_LENGTH) {
          setValidationError(
            `요청 메시지는 ${MATCH_REQUEST_NOTE_MAX_LENGTH}자 이하로 입력해 주세요.`,
          );
          return;
        }
        setValidationError(null);
        onSubmit({ note: trimmedNote || null });
      }}
    >
      {blockedMessage ? (
        <section
          role="alert"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
        >
          {blockedMessage}
        </section>
      ) : (
        <>
          <label className="block" htmlFor="roommate-match-request-note">
            <span className="text-sm font-semibold text-(--knu-text-primary)">
              요청 메시지 (선택)
            </span>
            <textarea
              id="roommate-match-request-note"
              value={note}
              maxLength={MATCH_REQUEST_NOTE_MAX_LENGTH + 1}
              disabled={submitting}
              aria-describedby={noteDescriptionId}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-(--knu-border) px-3 py-3 text-sm outline-none focus:border-(--knu-primary) disabled:opacity-60"
              placeholder="예: 생활 리듬이 비슷해서 함께 지내 보고 싶어요."
            />
          </label>
          <p
            id="roommate-match-request-note-count"
            className="text-right text-xs text-(--knu-text-tertiary)"
          >
            {trimmedNote.length}/{MATCH_REQUEST_NOTE_MAX_LENGTH}자
          </p>
        </>
      )}

      {currentError ? <MatchRequestDialogErrorMessage message={currentError} /> : null}

      <div className="grid gap-2">
        <button
          type="submit"
          disabled={submitting || Boolean(blockedMessage)}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed ${
            blockedMessage
              ? 'bg-amber-50 text-amber-700 disabled:opacity-100'
              : 'bg-(--knu-primary) text-white disabled:opacity-60'
          }`}
        >
          {submitting ? '요청 전송 중' : '매칭 요청 보내기'}
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

function MatchRequestDialogErrorMessage({ message }: { readonly message: string }) {
  if (message === ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE) {
    return (
      <p
        id="roommate-match-request-status"
        role="alert"
        className="text-sm font-semibold text-red-600"
      >
        <span>상대가 매칭이 완료되어 매칭 요청을 보낼 수 없어요.</span>
        <span className="block sm:inline">
          <span className="hidden sm:inline"> </span>
          목록을 새로고침 후 다른 후보를 찾아보세요.
        </span>
      </p>
    );
  }

  return (
    <p
      id="roommate-match-request-status"
      role="alert"
      className="whitespace-pre-line text-sm font-semibold text-red-600"
    >
      {message}
    </p>
  );
}
