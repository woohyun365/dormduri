import type { FormEvent } from 'react';
import type { AccountListResponse } from '@repo/shared/backoffice';
import { Button } from '@/ui/Button';
import { TextAreaField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import type { ResultMessage } from '@/ui/result-message';

/**
 * A risky action confirmed in a centered dialog: what ends, the reason, then the passkey step. Only its last action is
 * solid red (design guide ⑥); a failure stays inside.
 */
export function DeactivateDialog({
  target,
  pending,
  failure,
  onSubmit,
  onClose,
}: {
  readonly target: AccountListResponse['accounts'][number];
  readonly pending: boolean;
  readonly failure: ResultMessage | null;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onClose: () => void;
}) {
  return (
    <Overlay
      id="deactivate-confirm"
      variant="confirm"
      title="계정 비활성화"
      description={`${target.displayName}(${target.email}) 계정을 비활성화합니다. 그 계정의 역할과 접속도 끝납니다.`}
      onClose={onClose}
      footer={
        <Button type="submit" form="deactivate-form" tone="danger-solid" disabled={pending}>
          비활성화
        </Button>
      }
    >
      <form id="deactivate-form" aria-label="계정 비활성화" onSubmit={onSubmit}>
        <TextAreaField
          id="deactivate-reason"
          name="reason"
          label="비활성화 사유"
          hint="업무 변경·퇴직 같은 사유만 적고 사용자 개인정보는 쓰지 마세요. passkey로 다시 확인합니다."
          required
          maxLength={500}
        />
      </form>
      {failure ? (
        <Notice tone={failure.tone} role={failure.role}>
          {failure.text}
        </Notice>
      ) : null}
    </Overlay>
  );
}
