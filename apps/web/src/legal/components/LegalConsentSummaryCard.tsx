'use client';

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
  label: string;
  document: LegalDocumentResponse;
  summary: string[];
}

interface LegalConsentSummaryCardProps {
  checks: SignupLegalConsentChecks;
  bundle: ActiveLegalDocumentsBundleResponse;
  source: 'api' | 'fallback';
  disabled?: boolean;
  onToggle: (field: SignupLegalConsentField, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenDocument: (document: LegalDocumentResponse) => void;
}

function legalDocumentSummary(document: LegalDocumentResponse, fallback: string[]) {
  return document.summaryItems.length > 0 ? document.summaryItems : fallback;
}

function consentItems(bundle: ActiveLegalDocumentsBundleResponse): ConsentItem[] {
  return [
    {
      field: 'agreeAge',
      title: '만 14세 이상 확인',
      label: '[필수] 만 14세 이상입니다',
      document: bundle.age14OrAboveNotice,
      summary: legalDocumentSummary(bundle.age14OrAboveNotice, [
        'KNU 룸메는 만 14세 이상 사용자만 가입할 수 있습니다.',
      ]),
    },
    {
      field: 'agreeTerms',
      title: '이용약관 동의',
      label: '[필수] 이용약관에 동의합니다',
      document: bundle.termsOfService,
      summary: legalDocumentSummary(bundle.termsOfService, [
        '서비스 운영 주체, 이용 범위, 금지 행위와 운영 조치를 확인합니다.',
      ]),
    },
    {
      field: 'agreePersonalDataCollectionUse',
      title: '개인정보 수집·이용 동의',
      label: '[필수] 개인정보 수집·이용에 동의합니다',
      document: bundle.personalDataCollectionUseConsent,
      summary: [
        '목적: 회원가입, 이메일 인증, 룸메이트 탐색·매칭, 신고·문의 처리에 사용합니다.',
        '항목: 이메일, 비밀번호, 닉네임, 성별, 캠퍼스, 단과대, 출생연도와 서비스 이용 중 필요한 프로필·매칭 기록입니다.',
        '보유기간: 탈퇴 또는 목적 달성 시 삭제하되 신고·분쟁·법령상 보존이 필요한 정보는 분리 보관 후 파기합니다.',
        '거부권: 필수 수집·이용에 동의하지 않으면 회원가입과 서비스 이용이 제한됩니다.',
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
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold text-(--knu-text-primary)"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 rounded border-(--knu-border) text-(--knu-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
      />
      <span className="leading-6">{label}</span>
    </label>
  );
}

export function LegalConsentSummaryCard({
  checks,
  bundle,
  source,
  disabled,
  onToggle,
  onToggleAll,
  onOpenDocument,
}: LegalConsentSummaryCardProps) {
  const allChecked = checks.agreeAge && checks.agreeTerms && checks.agreePersonalDataCollectionUse;
  const items = consentItems(bundle);

  return (
    <section
      aria-labelledby="signup-legal-consent-heading"
      className="space-y-4 rounded-2xl border-2 border-(--knu-border) bg-white p-4"
    >
      <div className="rounded-xl bg-(--knu-background-alt) p-4">
        <ConsentCheckbox
          id="signup-legal-consent-all"
          label="필수 항목 전체 동의"
          checked={allChecked}
          disabled={disabled}
          onChange={onToggleAll}
        />
      </div>

      {source === 'fallback' && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          현재 공개 문서를 불러오지 못해 저장된 안내를 표시하고 있어요. 가입 시점에 서버의 최신
          문서와 다르면 다시 확인을 요청합니다.
        </p>
      )}

      <div className="space-y-3">
        <h3 id="signup-legal-consent-heading" className="sr-only">
          회원가입 필수 법적 동의
        </h3>
        {items.map((item) => (
          <article key={item.field} className="rounded-2xl border border-(--knu-border) p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-(--knu-primary)">{item.title}</p>
                <ConsentCheckbox
                  id={`signup-legal-${item.field}`}
                  label={item.label}
                  checked={checks[item.field]}
                  disabled={disabled}
                  onChange={(checked) => onToggle(item.field, checked)}
                />
              </div>
              <button
                type="button"
                onClick={() => onOpenDocument(item.document)}
                className="min-h-11 shrink-0 rounded-xl border border-(--knu-border) px-4 text-sm font-semibold text-(--knu-primary) transition-colors hover:bg-(--knu-primary-light)"
              >
                전문 보기
              </button>
            </div>
            <ul className="mt-3 space-y-2 pl-5 text-xs leading-5 text-(--knu-text-secondary)">
              {item.summary.map((summary) => (
                <li key={summary} className="list-disc">
                  {summary}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <article className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700">개인정보 처리방침 안내</p>
            <h4 className="mt-1 text-sm font-bold text-blue-950">
              처리방침은 공개 안내 문서로 확인합니다
            </h4>
            <p className="mt-2 text-xs leading-5 text-blue-900">
              개인정보 처리방침은 개인정보를 어떻게 처리하고 보호하는지 공개하는 문서입니다. 가입
              동의 대상은 별도의 개인정보 수집·이용 동의이며, 처리방침은 표시된 버전을 가입 기록에
              함께 남깁니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenDocument(bundle.privacyPolicy)}
            className="min-h-11 shrink-0 rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-white/70"
          >
            처리방침 보기
          </button>
        </div>
      </article>
    </section>
  );
}
