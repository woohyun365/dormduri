'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ActiveLegalDocumentsBundleResponse, LegalDocumentResponse } from '@repo/shared/legal';

export type SignupLegalConsentChecks = {
  agreeAge: boolean;
  agreeTerms: boolean;
  agreePersonalDataCollectionUse: boolean;
};

type SignupLegalConsentField = keyof SignupLegalConsentChecks;

interface ConsentItem {
  field: SignupLegalConsentField;
  title: string;
  document: LegalDocumentResponse;
  summary?: string;
  details?: readonly {
    term: string;
    description: string;
  }[];
}

interface LegalConsentSummaryCardProps {
  checks: SignupLegalConsentChecks;
  bundle: ActiveLegalDocumentsBundleResponse;
  disabled?: boolean;
  onToggle: (field: SignupLegalConsentField, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenDocument: (document: LegalDocumentResponse) => void;
}

function consentItems(bundle: ActiveLegalDocumentsBundleResponse): ConsentItem[] {
  return [
    {
      field: 'agreeAge',
      title: '만 14세 이상이에요',
      document: bundle.age14OrAboveNotice,
    },
    {
      field: 'agreeTerms',
      title: '이용약관 동의',
      document: bundle.termsOfService,
      summary: '서비스를 이용할 때 알아두고 지켜야 할 내용을 확인해요.',
    },
    {
      field: 'agreePersonalDataCollectionUse',
      title: '개인정보 수집·이용 동의',
      document: bundle.personalDataCollectionUseConsent,
      details: [
        {
          term: '목적',
          description: '계정 생성, 룸메이트 탐색·매칭, 신고·문의 처리',
        },
        {
          term: '항목',
          description: '이메일·닉네임·학교 정보·프로필·이용 기록',
        },
        {
          term: '보유기간',
          description: '탈퇴 또는 목적 달성 시까지',
        },
        {
          term: '별도 보관',
          description: '신고·분쟁·법령상 필요한 기록은 분리 보관',
        },
        {
          term: '거부 시',
          description: '동의하지 않으면 가입할 수 없어요.',
        },
      ],
    },
  ];
}

function ConsentCheckbox({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-12 cursor-pointer items-center gap-3 text-sm font-semibold text-(--knu-text-primary)"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 rounded border-slate-400 text-(--knu-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
      />
      <span className="leading-6">{label}</span>
    </label>
  );
}

export function LegalConsentSummaryCard({
  checks,
  bundle,
  disabled,
  onToggle,
  onToggleAll,
  onOpenDocument,
}: LegalConsentSummaryCardProps) {
  const allChecked = checks.agreeAge && checks.agreeTerms && checks.agreePersonalDataCollectionUse;
  const items = consentItems(bundle);

  return (
    <section aria-labelledby="signup-legal-consent-heading" className="space-y-4">
      <h3 id="signup-legal-consent-heading" className="sr-only">
        회원가입 필수 법적 동의
      </h3>

      <div className="-mx-5 rounded-none bg-slate-100 px-5 py-2.5 sm:-mx-4 sm:rounded-xl sm:px-4 sm:py-2">
        <ConsentCheckbox
          id="signup-legal-consent-all"
          label="필수 항목 모두 동의"
          checked={allChecked}
          disabled={disabled}
          onChange={onToggleAll}
        />
      </div>

      <div className="divide-y divide-(--knu-border) border-y border-(--knu-border)">
        {items.map((item) => (
          <article key={item.field} className="py-5">
            <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2">
              <input
                id={`signup-legal-${item.field}`}
                type="checkbox"
                checked={checks[item.field]}
                disabled={disabled}
                onChange={(event) => onToggle(item.field, event.target.checked)}
                className="size-5 rounded border-(--knu-border) text-(--knu-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
              />
              <label
                htmlFor={`signup-legal-${item.field}`}
                className="min-w-0 cursor-pointer text-sm font-semibold leading-6 text-(--knu-text-primary)"
              >
                <span className="text-(--knu-primary)">[필수]</span> {item.title}
              </label>
              <button
                type="button"
                aria-label={`${item.title} 내용 보기`}
                onClick={() => onOpenDocument(item.document)}
                className="group inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end rounded-lg text-xs font-semibold text-(--knu-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
              >
                <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors group-hover:bg-indigo-50 group-active:bg-indigo-100">
                  <span className="min-[360px]:hidden">보기</span>
                  <span className="hidden min-[360px]:inline">내용 보기</span>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              </button>

              {item.summary && (
                <p className="col-span-3 col-start-1 keep-all text-xs leading-5 text-(--knu-text-secondary) sm:col-span-2 sm:col-start-2">
                  {item.summary}
                </p>
              )}

              {item.details && (
                <dl className="col-span-3 col-start-1 -mx-0.5 mt-2 grid gap-2 text-xs leading-5 sm:col-span-2 sm:col-start-2 sm:mx-0">
                  {item.details.map((detail) => (
                    <div
                      key={detail.term}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-1.5 sm:grid-cols-[4.25rem_minmax(0,1fr)] sm:gap-2"
                    >
                      <dt className="font-semibold text-(--knu-text-primary)">{detail.term}</dt>
                      <dd className="keep-all text-(--knu-text-secondary)">{detail.description}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
        <h4 className="min-w-0 text-sm font-semibold text-(--knu-text-primary)">
          개인정보 처리방침
        </h4>
        <button
          type="button"
          onClick={() => onOpenDocument(bundle.privacyPolicy)}
          className="group inline-flex min-h-11 min-w-11 shrink-0 items-start justify-end rounded-lg text-xs font-semibold text-(--knu-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
        >
          <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors group-hover:bg-indigo-50 group-active:bg-indigo-100">
            처리방침 보기
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        </button>
        <p className="col-span-2 -mt-5 keep-all text-xs leading-5 text-(--knu-text-secondary)">
          내 정보가 어떻게 이용되고 보호되는지 확인해요.
        </p>
      </div>
    </section>
  );
}
