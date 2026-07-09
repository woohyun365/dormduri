import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { SupportAppealCategory, SupportTicketCategory } from '@repo/shared/support';
import {
  SUPPORT_APPEAL_FORM_CATEGORIES,
  SUPPORT_TICKET_FORM_CATEGORIES,
} from '../model/supportTicketDisplay.mapper';

export type SupportTicketFormValues = Readonly<{
  category: SupportTicketCategory;
  appealCategory: SupportAppealCategory | null;
  subject: string;
  body: string;
  emailReplyConsent: boolean;
  relatedEntityId: string | null;
}>;

export function SupportTicketForm({
  values,
  submitting,
  error,
  onChange,
  onSubmit,
}: {
  values: SupportTicketFormValues;
  submitting: boolean;
  error: string | null;
  onChange: (values: SupportTicketFormValues) => void;
  onSubmit: () => void;
}) {
  const appealCategories =
    values.relatedEntityId && values.appealCategory === 'REPORT_RESULT'
      ? SUPPORT_APPEAL_FORM_CATEGORIES.filter((category) => category.value === 'REPORT_RESULT')
      : SUPPORT_APPEAL_FORM_CATEGORIES.filter((category) => category.value !== 'REPORT_RESULT');

  const submitDisabled =
    submitting ||
    !values.subject.trim() ||
    !values.body.trim() ||
    (values.category === 'APPEAL' &&
      (!values.appealCategory ||
        (values.appealCategory === 'REPORT_RESULT' && !values.relatedEntityId)));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm md:p-5"
    >
      <div>
        <h2 className="text-base font-black text-(--knu-text-primary)">새 문의 남기기</h2>
        <p className="mt-1 text-sm leading-relaxed text-(--knu-text-secondary)">
          답변은 문의 내역과 알림함에서 확인할 수 있어요.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-bold text-(--knu-text-tertiary)">
          문의 유형
          <select
            value={values.category}
            onChange={(event) => {
              const category = event.target.value as SupportTicketCategory;
              onChange({
                ...values,
                category,
                appealCategory:
                  category === 'APPEAL' ? (values.appealCategory ?? 'SANCTION') : null,
                relatedEntityId: category === 'APPEAL' ? values.relatedEntityId : null,
              });
            }}
            className="mt-1 w-full rounded-2xl border border-(--knu-border) bg-white px-3 py-2.5 text-sm font-bold text-(--knu-text-primary) outline-none focus:border-emerald-500"
          >
            {SUPPORT_TICKET_FORM_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        {values.category === 'APPEAL' && values.relatedEntityId && (
          <p className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-800">
            {values.appealCategory === 'REPORT_RESULT'
              ? '신고 내역과 연결된 이의 신청이에요.'
              : '이용 제한 내역과 연결된 이의 신청이에요.'}{' '}
            이미지나 추가 파일 없이 텍스트로만 접수돼요.
          </p>
        )}

        {values.category === 'APPEAL' && (
          <label className="block text-xs font-bold text-(--knu-text-tertiary)">
            이의 신청 유형
            <select
              value={values.appealCategory ?? 'SANCTION'}
              onChange={(event) =>
                onChange({
                  ...values,
                  appealCategory: event.target.value as SupportAppealCategory,
                })
              }
              className="mt-1 w-full rounded-2xl border border-(--knu-border) bg-white px-3 py-2.5 text-sm font-bold text-(--knu-text-primary) outline-none focus:border-emerald-500"
            >
              {appealCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs font-bold text-(--knu-text-tertiary)">
          제목
          <input
            value={values.subject}
            onChange={(event) => onChange({ ...values, subject: event.target.value })}
            maxLength={120}
            className="mt-1 w-full rounded-2xl border border-(--knu-border) bg-white px-3 py-2.5 text-sm text-(--knu-text-primary) outline-none placeholder:text-(--knu-text-tertiary) focus:border-emerald-500"
            placeholder="문의 제목을 입력해주세요."
          />
        </label>

        <label className="block text-xs font-bold text-(--knu-text-tertiary)">
          내용
          <textarea
            value={values.body}
            onChange={(event) => onChange({ ...values, body: event.target.value })}
            rows={5}
            maxLength={4000}
            className="mt-1 w-full resize-none rounded-2xl border border-(--knu-border) bg-white px-3 py-2.5 text-sm text-(--knu-text-primary) outline-none placeholder:text-(--knu-text-tertiary) focus:border-emerald-500"
            placeholder="상황을 구체적으로 알려주면 더 빠르게 확인할 수 있어요."
          />
        </label>

        <label className="flex items-start gap-2 rounded-2xl bg-white/75 p-3 text-xs font-bold leading-relaxed text-(--knu-text-secondary)">
          <input
            type="checkbox"
            checked={values.emailReplyConsent}
            onChange={(event) => onChange({ ...values, emailReplyConsent: event.target.checked })}
            className="mt-0.5 size-4"
          />
          이메일로도 답변 알림을 받을게요. 민감한 문의 원문은 알림에 표시하지 않아요.
        </label>
      </div>

      {error && (
        <p
          className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <Send className="size-4" aria-hidden="true" />
        문의 접수하기
      </button>
    </form>
  );
}
