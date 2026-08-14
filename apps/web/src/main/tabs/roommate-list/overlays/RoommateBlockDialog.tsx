import { useState } from 'react';
import { BLOCK_NOTE_MAX_LENGTH } from '@repo/shared/social-safety/block';
import { RoommateActionConfirmationDialog } from './RoommateActionConfirmationDialog';
import type { RoommateActionDialogState } from '../hooks/useRoommateActions';

interface RoommateBlockDialogProps {
  readonly state: RoommateActionDialogState;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: { readonly note?: string | null }) => void;
}

export function RoommateBlockDialog({
  state,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: RoommateBlockDialogProps) {
  const target = state.kind === 'block' ? state.target : null;

  return (
    <RoommateActionConfirmationDialog
      isOpen={target !== null}
      onClose={onClose}
      title="룸메이트 차단"
      tone="red"
      headline={target ? `${target.nickname}님을 차단할까요?` : ''}
      noticeTitle="차단 전 알아야 할 사항"
      noticeItems={[
        '차단하면 서로의 룸메 목록에서 보이지 않아요.',
        '기존 비매칭 대화는 읽기 전용으로 바뀔 수 있어요.',
        '차단은 차단 목록에서 해제할 수 있고, 상대에게 알리지 않아요.',
      ]}
    >
      {target ? (
        <RoommateBlockForm
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

function RoommateBlockForm({
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
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
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmedNote.length > BLOCK_NOTE_MAX_LENGTH) {
          setValidationError(`차단 메모는 ${BLOCK_NOTE_MAX_LENGTH}자 이하로 입력해 주세요.`);
          return;
        }
        setValidationError(null);
        onSubmit({ note: trimmedNote || null });
      }}
    >
      <label className="block" htmlFor="roommate-block-note">
        <span className="text-sm font-semibold text-(--knu-text-primary)">차단 메모 (선택)</span>
        <textarea
          id="roommate-block-note"
          value={note}
          maxLength={BLOCK_NOTE_MAX_LENGTH + 1}
          disabled={submitting}
          aria-describedby={
            currentError
              ? 'roommate-block-note-help roommate-block-status'
              : 'roommate-block-note-help'
          }
          onChange={(event) => setNote(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-2xl border border-(--knu-border) px-3 py-3 text-sm outline-none focus:border-(--knu-primary) disabled:opacity-60"
          placeholder="추후에 차단 이유를 확인하는 본인 참고용 메모예요."
        />
      </label>
      <p id="roommate-block-note-help" className="text-xs text-(--knu-text-tertiary)">
        {trimmedNote.length}/{BLOCK_NOTE_MAX_LENGTH}자
      </p>

      {currentError ? (
        <p id="roommate-block-status" role="alert" className="text-sm font-semibold text-red-600">
          {currentError}
        </p>
      ) : null}

      <div className="grid gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '차단 처리 중' : '차단하기'}
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
