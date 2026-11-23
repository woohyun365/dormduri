'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { postBff } from '@/client/bff-client';
import { errorMessage } from '@/ui/error-messages';
import { Button, FormMessage, TextAreaField } from '@/ui/forms';

/** Monthly check of this audit against the SSM session trail (OA-R8), recorded as an audit row. */
export function AuditReviewForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const note = String(new FormData(formElement).get('note') ?? '').trim();
    setPending(true);
    setMessage(null);
    const result = await postBff('/api/audit/reviews', note ? { note } : {});
    setPending(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: errorMessage(result.code) });
      return;
    }
    formElement.reset();
    setMessage({ tone: 'success', text: '점검 완료를 기록했습니다.' });
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void record(event)}
      className="flex flex-col gap-3"
      aria-label="월 점검 기록"
    >
      <p className="text-sm text-slate-700">
        이 감사 기록과 CloudTrail trail의 SSM 접속 기록을 대조한 뒤 점검 완료를 남깁니다.
      </p>
      <TextAreaField
        id="audit-review-note"
        name="note"
        label="점검 메모(선택)"
        hint="대조 결과만 적고 식별자·사용자 개인정보는 쓰지 마세요."
        maxLength={500}
      />
      <Button type="submit" disabled={pending}>
        점검 완료 기록
      </Button>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
    </form>
  );
}
