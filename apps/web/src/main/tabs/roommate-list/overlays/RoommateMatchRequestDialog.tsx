import { useState } from 'react';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import type {
  RoommateActionDialogState,
  RoommateActionTargetSnapshot,
} from '../hooks/useRoommateActions';

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
    <BaseBottomSheet isOpen={target !== null} onClose={onClose} title="매칭 요청 보내기">
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
    </BaseBottomSheet>
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
  const currentError = validationError ?? errorMessage ?? null;

  return (
    <form
      className="space-y-5 px-5 py-5"
      onSubmit={(event) => {
        event.preventDefault();
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
      <section className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-4">
        <p className="text-sm font-bold text-[var(--knu-text-primary)]">
          {target.nickname}님에게 매칭 요청을 보낼까요?
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
          요청은 대화방 없이도 보낼 수 있고, 상대가 수락하면 바로 매칭이 확정돼요. 서버가 전송
          시점의 시즌·기숙사·프로필 상태를 다시 확인해요.
        </p>
      </section>

      <label className="block" htmlFor="roommate-match-request-note">
        <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
          요청 메시지 (선택)
        </span>
        <textarea
          id="roommate-match-request-note"
          value={note}
          maxLength={MATCH_REQUEST_NOTE_MAX_LENGTH + 1}
          disabled={submitting}
          aria-describedby="roommate-match-request-note-help roommate-match-request-status"
          onChange={(event) => setNote(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--knu-border)] px-3 py-3 text-sm outline-none focus:border-[var(--knu-primary)] disabled:opacity-60"
          placeholder="짧게 인사말을 남겨 보세요."
        />
      </label>
      <p id="roommate-match-request-note-help" className="text-xs text-[var(--knu-text-tertiary)]">
        {trimmedNote.length}/{MATCH_REQUEST_NOTE_MAX_LENGTH}자
      </p>

      {currentError ? (
        <p
          id="roommate-match-request-status"
          role="alert"
          className="text-sm font-semibold text-red-600"
        >
          {currentError}
        </p>
      ) : (
        <p
          id="roommate-match-request-status"
          role="status"
          className="text-xs text-[var(--knu-text-tertiary)]"
        >
          같은 상대에 대한 진행 중 요청이 있거나 마감이 지난 경우 서버에서 안전하게 거절돼요.
        </p>
      )}

      <div className="grid gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '요청 전송 중' : '매칭 요청 보내기'}
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
