import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportPageApi, SupportPageFetchError } from '../api/support-page.api';

const iso = '2026-07-03T00:00:00.000Z';

function stubFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': contentType } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function ticket() {
  return {
    id: 'ticket-1',
    category: 'BUG',
    subject: '버그 문의',
    status: 'OPEN',
    relatedEntityId: null,
    appealCategory: null,
    emailReplyConsent: false,
    lastMessageAt: iso,
    closedAt: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

describe('supportPageApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('support ticket 생성 body를 shared contract로 검증하고 BFF로 보낸다', async () => {
    const fetchMock = stubFetch({ ticket: ticket() });

    await expect(
      supportPageApi.createTicket({
        category: 'BUG',
        subject: '버그 문의',
        body: '화면에서 오류가 발생했어요.',
        emailReplyConsent: true,
      }),
    ).resolves.toMatchObject({ ticket: { id: 'ticket-1' } });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/support/tickets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          category: 'BUG',
          subject: '버그 문의',
          body: '화면에서 오류가 발생했어요.',
          emailReplyConsent: true,
        }),
      }),
    );
  });

  it('APPEAL ticket 생성 시 appealCategory를 함께 전달한다', async () => {
    const fetchMock = stubFetch({
      ticket: { ...ticket(), category: 'APPEAL', appealCategory: 'REPORT_RESULT' },
    });

    await expect(
      supportPageApi.createTicket({
        category: 'APPEAL',
        appealCategory: 'REPORT_RESULT',
        subject: '신고 처리 이의 신청',
        body: '처리 결과 재검토를 요청합니다.',
        emailReplyConsent: false,
        relatedEntityId: 'report-1',
      }),
    ).resolves.toMatchObject({ ticket: { category: 'APPEAL' } });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/support/tickets',
      expect.objectContaining({ method: 'POST' }),
    );
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(firstCall[1].body))).toEqual({
      category: 'APPEAL',
      appealCategory: 'REPORT_RESULT',
      subject: '신고 처리 이의 신청',
      body: '처리 결과 재검토를 요청합니다.',
      emailReplyConsent: false,
      relatedEntityId: 'report-1',
    });
  });

  it('내 신고 내역 list를 report BFF contract로 조회한다', async () => {
    const fetchMock = stubFetch({
      items: [
        {
          id: 'report-1',
          targetType: 'PROFILE',
          targetLabel: '감자친구님',
          reason: 'FALSE_PROFILE',
          receivedAt: iso,
          status: 'RECEIVED',
        },
      ],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    await expect(supportPageApi.listReports({ limit: 10 })).resolves.toMatchObject({
      items: [{ id: 'report-1', targetLabel: '감자친구님' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reports?limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('내 이용 제한 내역 list를 enforcement BFF contract로 조회한다', async () => {
    const fetchMock = stubFetch({
      items: [
        {
          id: 'season-participant:participant-1',
          actionType: 'MATCHING_RESTRICTION',
          reasonCategory: 'HATE_OR_DISCRIMINATION',
          status: 'ACTIVE',
          seasonLabel: '2026년 2학기',
          scopeLabel: '2026년 2학기 · 다산관 룸메 탐색/매칭',
          policyBasisSummary: '서비스 이용 기준에 따라 필요한 범위에서 적용된 제한이에요.',
          effectiveFrom: iso,
          effectiveUntil: '2026-08-31T00:00:00.000Z',
          createdAt: iso,
        },
      ],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    await expect(supportPageApi.listEnforcements({ limit: 10 })).resolves.toMatchObject({
      items: [{ id: 'season-participant:participant-1', reasonCategory: 'HATE_OR_DISCRIMINATION' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/enforcements?limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('schema mismatch는 raw internal 값을 노출하지 않는 typed error로 반환한다', async () => {
    stubFetch({ ticket: { internalNote: 'must-not-leak' } });

    await expect(supportPageApi.listTickets()).rejects.toMatchObject({
      name: 'SupportPageFetchError',
      code: 'SUPPORT_UPSTREAM_INVALID',
      message: 'Support response did not match the public contract.',
    } satisfies Partial<SupportPageFetchError>);
  });
});
