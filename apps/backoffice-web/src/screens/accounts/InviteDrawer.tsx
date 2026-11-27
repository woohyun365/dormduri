import type { FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import type { ResultMessage } from '@/ui/result-message';

/** The operator invitation in the right drawer: a failure stays inside with what was typed (design guide ⑥). */
export function InviteDrawer({
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
      id="invite-overlay"
      title="운영자 초대"
      onClose={onClose}
      busy={pending}
      footer={
        <Button type="submit" form="invite-form" disabled={pending}>
          초대 code 만들기
        </Button>
      }
    >
      <form
        id="invite-form"
        aria-label="운영자 초대"
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
      >
        <TextField
          id="invite-email"
          name="email"
          type="email"
          label="이메일"
          required
          maxLength={254}
        />
        <TextField id="invite-name" name="displayName" label="이름" required maxLength={80} />
        <p className="text-caption text-fg-muted">
          초대 code는 만든 화면에서 한 번만 보입니다. 역할은 등록 뒤 권한 요청으로 줍니다.
        </p>
      </form>
      {failure ? (
        <Notice tone={failure.tone} role={failure.role}>
          {failure.text}
        </Notice>
      ) : null}
    </Overlay>
  );
}
