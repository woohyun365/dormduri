import type { FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { TextAreaField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import type { ResultMessage } from '@/ui/result-message';

/** The monthly check of this audit against the SSM session trail (OA-R8), recorded as an audit row, in a drawer. */
export function AuditReviewDrawer({
  pending,
  failure,
  onSubmit,
  onClose,
}: {
  readonly pending: boolean;
  readonly failure: ResultMessage | null;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onClose: () => void;
}) {
  return (
    <Overlay
      id="audit-review"
      title="월 점검 기록"
      onClose={onClose}
      busy={pending}
      footer={
        <Button type="submit" form="audit-review-form" disabled={pending}>
          점검 완료 기록
        </Button>
      }
    >
      <form
        id="audit-review-form"
        aria-label="월 점검 기록"
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
      >
        <p className="text-body text-fg-description">
          이 감사 기록과 CloudTrail trail의 SSM 접속 기록을 대조한 뒤 점검 완료를 남깁니다.
        </p>
        <TextAreaField
          id="audit-review-note"
          name="note"
          label="점검 메모(선택)"
          hint="대조 결과만 적고 식별자·사용자 개인정보는 쓰지 마세요."
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
