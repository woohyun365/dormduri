'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SupportFaqItem,
  SupportTicketDetailResponse,
  SupportTicketResponse,
} from '@repo/shared/support';
import type { EnforcementNotice } from '@repo/shared/social-safety/enforcement';
import type { ReportListItem } from '@repo/shared/social-safety/report';
import { BrandLogo } from '@/screens/ui/brand';
import { supportPageApi } from './api/support-page.api';
import { SupportEnforcementNoticeList } from './components/SupportEnforcementNoticeList';
import { SupportFaqList } from './components/SupportFaqList';
import { SupportReportList } from './components/SupportReportList';
import { SupportTicketForm, type SupportTicketFormValues } from './components/SupportTicketForm';
import { SupportTicketList } from './components/SupportTicketList';
import { SupportTicketThread } from './components/SupportTicketThread';
import { toSupportTicketListItemViewModel } from './model/supportTicketDisplay.mapper';

type PageStatus = 'loading' | 'success' | 'error';

const DEFAULT_FORM_VALUES: SupportTicketFormValues = {
  category: 'OTHER',
  appealCategory: null,
  subject: '',
  body: '',
  emailReplyConsent: false,
  relatedEntityId: null,
};

export default function SupportPageClient({
  initialTicketIdOverride,
}: {
  initialTicketIdOverride?: string | null;
} = {}) {
  const searchParams = useSearchParams();
  const initialTicketId = initialTicketIdOverride ?? searchParams.get('ticketId');
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<SupportFaqItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketResponse[]>([]);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [enforcementNotices, setEnforcementNotices] = useState<EnforcementNotice[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId);
  const selectedTicketIdRef = useRef(selectedTicketId);
  const [ticketDetail, setTicketDetail] = useState<SupportTicketDetailResponse | null>(null);
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
  const [formValues, setFormValues] = useState<SupportTicketFormValues>(DEFAULT_FORM_VALUES);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicketId;
  }, [selectedTicketId]);

  const refresh = useCallback(async (isCancelled: () => boolean = () => false) => {
    setStatus('loading');
    setError(null);
    try {
      const [faqResponse, ticketResponse, reportResponse, enforcementResponse] = await Promise.all([
        supportPageApi.listFaq(),
        supportPageApi.listTickets({ limit: 20 }),
        supportPageApi.listReports({ limit: 20 }),
        supportPageApi.listEnforcements({ limit: 20 }),
      ]);
      if (isCancelled()) return;
      setFaqs(faqResponse.items);
      setTickets(ticketResponse.items);
      setReports(reportResponse.items);
      setEnforcementNotices(enforcementResponse.items);
      setStatus('success');
      if (!selectedTicketIdRef.current) {
        const nextTicketId = ticketResponse.items[0]?.id ?? null;
        setSelectedTicketId(nextTicketId);
        if (!nextTicketId) setTicketDetail(null);
      }
    } catch {
      if (isCancelled()) return;
      setStatus('error');
      setError('고객센터 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh(() => cancelled);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const loadTicketDetail = useCallback(async (ticketId: string, isCancelled: () => boolean) => {
    setTicketDetailLoading(true);
    setReplyError(null);
    try {
      const detail = await supportPageApi.getTicket(ticketId);
      if (isCancelled()) return;
      setTicketDetail(detail);
    } catch {
      if (isCancelled()) return;
      setTicketDetail(null);
      setReplyError('문의 상세를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (isCancelled()) return;
      setTicketDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTicketId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadTicketDetail(selectedTicketId, () => cancelled);
    });
    return () => {
      cancelled = true;
    };
  }, [loadTicketDetail, selectedTicketId]);

  const ticketItems = useMemo(() => tickets.map(toSupportTicketListItemViewModel), [tickets]);
  const reportItems = useMemo(
    () =>
      reports.map((report) => ({
        ...report,
        linkedTicketId:
          tickets.find(
            (ticket) =>
              ticket.category === 'APPEAL' &&
              ticket.appealCategory === 'REPORT_RESULT' &&
              ticket.relatedEntityId === report.id,
          )?.id ?? null,
      })),
    [reports, tickets],
  );
  const enforcementNoticeItems = useMemo(
    () =>
      enforcementNotices.map((notice) => ({
        ...notice,
        linkedTicketId:
          tickets.find(
            (ticket) =>
              ticket.category === 'APPEAL' &&
              (ticket.appealCategory === 'SANCTION' ||
                ticket.appealCategory === 'TEMPORARY_RESTRICTION') &&
              ticket.relatedEntityId === notice.id,
          )?.id ?? null,
      })),
    [enforcementNotices, tickets],
  );

  async function handleCreateTicket() {
    setFormSubmitting(true);
    setFormError(null);
    try {
      const response = await supportPageApi.createTicket({
        category: formValues.category,
        appealCategory: formValues.category === 'APPEAL' ? formValues.appealCategory : null,
        subject: formValues.subject.trim(),
        body: formValues.body.trim(),
        emailReplyConsent: formValues.emailReplyConsent,
        relatedEntityId: formValues.relatedEntityId,
      });
      setTickets((current) => [response.ticket, ...current]);
      setSelectedTicketId(response.ticket.id);
      setFormValues(DEFAULT_FORM_VALUES);
    } catch {
      setFormError('문의를 접수하지 못했어요. 내용을 확인하고 다시 시도해주세요.');
    } finally {
      setFormSubmitting(false);
    }
  }

  function handleCreateReportAppeal(report: ReportListItem) {
    setFormError(null);
    setFormValues({
      category: 'APPEAL',
      appealCategory: 'REPORT_RESULT',
      subject: '신고 처리 이의 신청',
      body: `${report.targetLabel}에 대한 신고 처리 결과 재검토를 요청합니다.

이의 사유: `,
      emailReplyConsent: false,
      relatedEntityId: report.id,
    });
  }

  function handleCreateEnforcementAppeal(notice: EnforcementNotice) {
    setFormError(null);
    const appealCategory =
      notice.status === 'ACTIVE' && notice.effectiveUntil ? 'TEMPORARY_RESTRICTION' : 'SANCTION';
    setFormValues({
      category: 'APPEAL',
      appealCategory,
      subject: '이용 제한 이의 신청',
      body: `${notice.scopeLabel}에 적용된 이용 제한에 대해 재검토를 요청합니다.

이의 사유: `,
      emailReplyConsent: false,
      relatedEntityId: notice.id,
    });
  }

  async function handleAppendMessage() {
    if (!selectedTicketId || !replyMessage.trim()) return;
    setReplySubmitting(true);
    setReplyError(null);
    try {
      const response = await supportPageApi.appendMessage(selectedTicketId, {
        body: replyMessage.trim(),
      });
      setTicketDetail((current) =>
        current
          ? { ticket: response.ticket, messages: [...current.messages, response.message] }
          : { ticket: response.ticket, messages: [response.message] },
      );
      setTickets((current) =>
        current.map((ticket) => (ticket.id === response.ticket.id ? response.ticket : ticket)),
      );
      setReplyMessage('');
    } catch {
      setReplyError('메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setReplySubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <header className="sticky top-0 z-10 border-b border-(--knu-border) bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link
            href="/main"
            className="flex items-center gap-2 rounded-xl text-xl font-bold text-(--knu-text-primary)"
          >
            <BrandLogo />
          </Link>
          <Link
            href="/main"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-(--knu-text-secondary) shadow-sm ring-1 ring-(--knu-border)"
          >
            홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm md:p-8">
          <p className="text-sm font-extrabold text-emerald-700">문의하기</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-(--knu-text-primary) md:text-4xl">
            FAQ를 확인하고 운영팀에 문의해요
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-(--knu-text-secondary) md:text-base">
            문의 본문과 답변은 본인 문의 내역에서만 확인해요. 답변이 오면 알림함에서 다시 이어갈 수
            있어요.
          </p>
        </section>

        {status === 'loading' && (
          <div
            className="mt-6 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]"
            aria-label="고객센터 로딩 중"
          >
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            {error}
            <button type="button" onClick={() => void refresh()} className="ml-3 underline">
              다시 시도
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside className="space-y-4">
              <SupportTicketForm
                values={formValues}
                submitting={formSubmitting}
                error={formError}
                onChange={setFormValues}
                onSubmit={() => void handleCreateTicket()}
              />
              <SupportReportList
                reports={reportItems}
                onCreateAppeal={handleCreateReportAppeal}
                onSelectTicket={setSelectedTicketId}
              />
              <SupportEnforcementNoticeList
                notices={enforcementNoticeItems}
                onCreateAppeal={handleCreateEnforcementAppeal}
                onSelectTicket={setSelectedTicketId}
              />
              <section className="rounded-3xl border border-(--knu-border) bg-white p-4 shadow-sm">
                <h2 className="text-base font-black text-(--knu-text-primary)">문의 내역</h2>
                <div className="mt-3">
                  <SupportTicketList
                    tickets={ticketItems}
                    selectedTicketId={selectedTicketId}
                    onSelectTicket={setSelectedTicketId}
                  />
                </div>
              </section>
            </aside>

            <div className="space-y-4">
              <SupportTicketThread
                detail={ticketDetail}
                loading={ticketDetailLoading}
                message={replyMessage}
                submitting={replySubmitting}
                messageError={replyError}
                onMessageChange={setReplyMessage}
                onSubmitMessage={() => void handleAppendMessage()}
              />
              <section className="rounded-3xl border border-(--knu-border) bg-white p-4 shadow-sm md:p-5">
                <h2 className="text-base font-black text-(--knu-text-primary)">자주 묻는 질문</h2>
                <div className="mt-3">
                  <SupportFaqList faqs={faqs} />
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
