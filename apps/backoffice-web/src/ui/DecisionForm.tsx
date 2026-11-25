'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { TextAreaField } from './fields';
import { Notice } from './Notice';
import { failureText, type ResultMessage } from './result-message';

/**
 * The decision area of an approval request (design guide ⑥, OA-R9): the reason, approve and reject, and the requester's
 * cancel at the row's end. The decider differs from the requester; only when the requester is the one active approver
 * may they approve their own request, with a reason (the API counts approvers at decision time and refuses otherwise),
 * so a self request has no reject. A rejection always needs a reason. `before` holds what the decider marks before
 * approving (a legal request's reading mark), and `approveBlocked` keeps approve closed until then.
 */
export function DecisionForm({
  label,
  reasonId,
  self,
  pending,
  failure,
  approveBlocked = false,
  before,
  cancel,
  onDecide,
}: {
  /** The form's accessible name, e.g. `요청 1a2b3c4d 결정`. */
  readonly label: string;
  readonly reasonId: string;
  /** The viewer made this request. */
  readonly self: boolean;
  readonly pending: boolean;
  /** The failure of the last decision or cancel, shown in the decision area. */
  readonly failure: ResultMessage | null;
  readonly approveBlocked?: boolean;
  readonly before?: ReactNode;
  /** The requester's cancel button, at the end of the button row. */
  readonly cancel?: ReactNode;
  readonly onDecide: (approve: boolean, reason: string) => void;
}) {
  const [missing, setMissing] = useState<string | null>(null);
  const shown = missing ? failureText(missing) : failure;

  function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    const approve = submitter?.value !== 'reject';
    if (!approve && !reason) {
      setMissing('거절 사유를 적으세요.');
      return;
    }
    if (approve && self && !reason) {
      setMissing('자기 승인 사유를 적으세요.');
      return;
    }
    setMissing(null);
    onDecide(approve, reason);
  }

  return (
    <form aria-label={label} className="flex flex-col gap-3" onSubmit={decide}>
      {before}
      <TextAreaField
        id={reasonId}
        name="reason"
        label={self ? '자기 승인 사유(필수)' : '결정 사유(거절할 때 필수)'}
        hint={
          self
            ? '승인 권한을 가진 운영자가 나 하나뿐일 때만 내 요청을 승인할 수 있습니다. 자기 승인은 감사에 표시되고 경보가 갑니다.'
            : '사용자 개인정보는 쓰지 마세요. 결정 전에 passkey로 다시 확인합니다.'
        }
        required={self}
        maxLength={500}
      />
      {shown ? (
        <Notice tone={shown.tone} role={shown.role}>
          {shown.text}
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" value="approve" disabled={pending || approveBlocked}>
          승인
        </Button>
        {self ? null : (
          <Button type="submit" value="reject" tone="danger" disabled={pending}>
            거절
          </Button>
        )}
        {cancel}
      </div>
    </form>
  );
}
