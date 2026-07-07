import { useState } from 'react';
import { BLOCK_NOTE_MAX_LENGTH } from '@repo/shared/social-safety/block';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import type {
  RoommateActionDialogState,
  RoommateActionTargetSnapshot,
} from '../hooks/useRoommateActions';

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
    <BaseBottomSheet isOpen={target !== null} onClose={onClose} title="룸메이트 차단">
      {target ? (
        <RoommateBlockForm
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

function RoommateBlockForm({
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
        if (trimmedNote.length > BLOCK_NOTE_MAX_LENGTH) {
          setValidationError(`차단 메모는 ${BLOCK_NOTE_MAX_LENGTH}자 이하로 입력해 주세요.`);
          return;
        }
        setValidationError(null);
        onSubmit({ note: trimmedNote || null });
      }}
    >
      <section className="rounded-3xl border border-(--knu-border) bg-white p-4">
        <p className="text-sm font-bold text-(--knu-text-primary)">
          {target.nickname}님을 차단할까요?
        </p>
        <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">
          차단하면 서로의 목록과 관심 목록에서 보이지 않을 수 있고, 기존 비매칭 대화는 읽기 전용으로
          바뀔 수 있어요.
        </p>
      </section>

      <label className="block" htmlFor="roommate-block-note">
        <span className="text-sm font-semibold text-(--knu-text-primary)">차단 메모 (선택)</span>
        <textarea
          id="roommate-block-note"
          value={note}
          maxLength={BLOCK_NOTE_MAX_LENGTH + 1}
          disabled={submitting}
          aria-describedby="roommate-block-note-help roommate-block-status"
          onChange={(event) => setNote(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-2xl border border-(--knu-border) px-3 py-3 text-sm outline-none focus:border-(--knu-primary) disabled:opacity-60"
          placeholder="운영 판단용이 아닌 본인 참고 메모예요."
        />
      </label>
      <p id="roommate-block-note-help" className="text-xs text-(--knu-text-tertiary)">
        {trimmedNote.length}/{BLOCK_NOTE_MAX_LENGTH}자
      </p>

      {currentError ? (
        <p id="roommate-block-status" role="alert" className="text-sm font-semibold text-red-600">
          {currentError}
        </p>
      ) : (
        <p id="roommate-block-status" role="status" className="text-xs text-(--knu-text-tertiary)">
          차단 요청은 서버에서 최신 상태를 다시 확인해 처리돼요.
        </p>
      )}

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
