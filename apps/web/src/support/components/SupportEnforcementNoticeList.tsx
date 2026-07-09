import { MessageCircleMore, Scale, ShieldAlert } from 'lucide-react';
import type {
  EnforcementActionType,
  EnforcementNotice,
  EnforcementReasonCategory,
} from '@repo/shared/social-safety/enforcement';

const ENFORCEMENT_ACTION_LABELS: Record<EnforcementActionType, string> = {
  WARNING: '경고',
  MATCHING_RESTRICTION: '매칭 제한',
  CHAT_RESTRICTION: '채팅 제한',
  ACCOUNT_RESTRICTION: '계정 제한',
  CONTENT_VISIBILITY_RESTRICTION: '프로필/목록 제한',
};

const ENFORCEMENT_REASON_LABELS: Record<EnforcementReasonCategory, string> = {
  SEXUAL_HARASSMENT: '성희롱/성적 불쾌감',
  THREAT: '협박/위협',
  PERSONAL_INFO_EXPOSURE: '개인정보 노출',
  GENDER_IMPERSONATION: '성별 사칭',
  FALSE_PROFILE: '허위 프로필',
  SPAM_OR_AD: '스팸/광고',
  HATE_OR_DISCRIMINATION: '혐오/차별 표현',
  POLICY_VIOLATION: '정책 위반',
  SAFETY_REVIEW: '운영 검토',
  ADMIN_ACTION: '운영 조치',
  OTHER: '기타',
};

export type SupportEnforcementNoticeListItemView = EnforcementNotice & {
  linkedTicketId: string | null;
};

export function SupportEnforcementNoticeList({
  notices,
  onCreateAppeal,
  onSelectTicket,
}: {
  notices: readonly SupportEnforcementNoticeListItemView[];
  onCreateAppeal: (notice: EnforcementNotice) => void;
  onSelectTicket: (ticketId: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <ShieldAlert className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-black text-(--knu-text-primary)">내 이용 제한 내역</h2>
          <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
            적용된 제한의 범위와 이의 신청 경로를 확인할 수 있어요.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {notices.length === 0 ? (
          <p className="rounded-2xl bg-(--knu-background-alt) p-3 text-sm font-bold text-(--knu-text-secondary)">
            적용된 이용 제한 내역이 없어요.
          </p>
        ) : (
          notices.map((notice) => {
            const linkedTicketId = notice.linkedTicketId;
            return (
              <article
                key={notice.id}
                className="rounded-2xl border border-red-100 bg-red-50/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-(--knu-text-primary)">
                      {ENFORCEMENT_ACTION_LABELS[notice.actionType]}
                    </p>
                    <p className="mt-1 text-xs font-bold text-red-700">
                      위반 사유: {ENFORCEMENT_REASON_LABELS[notice.reasonCategory]}
                    </p>
                  </div>
                  <time
                    dateTime={notice.effectiveFrom}
                    className="shrink-0 text-[11px] font-bold text-(--knu-text-tertiary)"
                  >
                    {formatShortDate(notice.effectiveFrom)}
                  </time>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs leading-relaxed text-(--knu-text-secondary)">
                  <div>
                    <dt className="font-extrabold text-(--knu-text-primary)">적용 범위</dt>
                    <dd>{notice.scopeLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold text-(--knu-text-primary)">기간</dt>
                    <dd>{formatPeriod(notice.effectiveFrom, notice.effectiveUntil)}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold text-(--knu-text-primary)">정책 기준</dt>
                    <dd>{notice.policyBasisSummary}</dd>
                  </div>
                </dl>

                {linkedTicketId ? (
                  <button
                    type="button"
                    onClick={() => onSelectTicket(linkedTicketId)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-extrabold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    <MessageCircleMore className="size-4" aria-hidden="true" />
                    운영자 대화 보기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCreateAppeal(notice)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    <Scale className="size-4" aria-hidden="true" />
                    이의 신청하기
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatPeriod(from: string, until: string | null): string {
  const fromLabel = formatShortDate(from);
  if (!until) return `${fromLabel}부터`;
  return `${fromLabel}부터 ${formatShortDate(until)}까지`;
}
