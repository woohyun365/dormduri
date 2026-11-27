'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { AuditEvent, PageCursor } from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import { PageHeader } from '@/ui/PageHeader';
import { success, useFailure, type ResultMessage } from '@/ui/result-message';
import { TextLink } from '@/ui/TextLink';
import { AuditDetail } from './AuditDetail';
import { AuditReviewDrawer } from './AuditReviewDrawer';
import { AuditTable } from './AuditTable';

/**
 * The admin audit (OA-R7, OA-R8): newest-first rows with the keyset links of the API, a row's every field in the right
 * drawer, and the monthly review recorded from a drawer by an auditor (design guide ④ list).
 */
export function AuditScreen({
  events,
  names,
  canReview,
  nextPage,
  laterPage,
}: {
  readonly events: readonly AuditEvent[];
  readonly names: Readonly<Record<string, string>>;
  readonly canReview: boolean;
  readonly nextPage: PageCursor | null;
  /** On a later page (`beforeTime` in the query): the link back to the first page shows. */
  readonly laterPage: boolean;
}) {
  const router = useRouter();
  const failure = useFailure();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFailure, setReviewFailure] = useState<ResultMessage | null>(null);
  const opened = events.find((event) => event.id === openId) ?? null;

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim();
    setPending(true);
    setReviewFailure(null);
    const result = await postBff('/api/audit/reviews', note ? { note } : {});
    setPending(false);
    if (!result.ok) {
      setReviewFailure(failure(result.code));
      return;
    }
    setReviewOpen(false);
    setMessage(success('점검 완료를 기록했습니다.'));
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="감사 기록"
        meta={`최신순 · 이 page ${events.length}건`}
        actions={
          canReview ? (
            <Button
              disabled={pending}
              onClick={() => {
                setReviewFailure(null);
                setReviewOpen(true);
              }}
            >
              월 점검 기록
            </Button>
          ) : null
        }
      />
      {message ? (
        <Notice tone={message.tone} role={message.role}>
          {message.text}
        </Notice>
      ) : null}

      <Card id="audit-events" title="최근 기록" flush>
        {events.length === 0 ? (
          <div className="px-card pb-card">
            <EmptyState icon="audit" title="기록이 없습니다." />
          </div>
        ) : (
          <AuditTable events={events} names={names} onOpen={setOpenId} />
        )}
        {nextPage || laterPage ? (
          <div className="flex gap-4 border-t border-stroke-subtle px-card py-3 text-body">
            {laterPage ? (
              <TextLink href="/audit" className="rounded-control">
                처음으로
              </TextLink>
            ) : null}
            {nextPage ? (
              <TextLink
                href={{ pathname: '/audit', query: { ...nextPage } }}
                className="rounded-control"
              >
                이전 기록 보기
              </TextLink>
            ) : null}
          </div>
        ) : null}
      </Card>

      {opened ? (
        <Overlay id="audit-detail" title="기록 상세" onClose={() => setOpenId(null)}>
          <AuditDetail event={opened} names={names} />
        </Overlay>
      ) : null}

      {reviewOpen ? (
        <AuditReviewDrawer
          pending={pending}
          failure={reviewFailure}
          onSubmit={(event) => void record(event)}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </>
  );
}
