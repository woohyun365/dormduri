import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegalBackofficeVersion, LegalDraft, LegalRequest } from '@repo/shared/backoffice';
import type { LegalRequestDetail } from './legal-types';
import { LegalRequestsScreen } from './LegalRequestsScreen';

// Legal publish and withdraw requests as a master-detail (design guide ④): the approver approves only after marking
// that they read the comparison (or, without a version before it, the whole text) with the notice class and the date;
// the only approver approves their own request with a reason after a passkey re-authentication (OA-R4, OA-R9).

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => search.params,
}));
const browser = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => browser);

const SELF = '1a7c3e90-0000-4000-8000-000000000001';
const OTHER = '2b8d4fa1-0000-4000-8000-000000000002';
const REQUEST_ID = '6b2e1d3f-0000-4000-8000-0000000000e1';
const SECOND_ID = '7c3f2e40-0000-4000-8000-0000000000e2';
const DRAFT_ID = '5a1f0c2e-0000-4000-8000-0000000000d1';
const APPROVE_URL = `/api/legal/requests/${REQUEST_ID}/approve`;
const REJECT_URL = `/api/legal/requests/${REQUEST_ID}/reject`;
const DIGEST = 'd'.repeat(64);
const fetchMock = vi.fn<typeof fetch>();

function request(overrides: Partial<LegalRequest> = {}): LegalRequest {
  return {
    id: REQUEST_ID,
    kind: 'LEGAL_PUBLISH',
    status: 'PENDING',
    contentDigest: DIGEST,
    targetLegalDraftId: DRAFT_ID,
    targetLegalVersionId: null,
    requestedByAccountId: OTHER,
    requestReason: null,
    expiresAt: '2026-12-02T01:00:00.000Z',
    decidedByAccountId: null,
    closedAt: null,
    decisionReason: null,
    selfApproved: false,
    createdAt: '2026-11-25T01:00:00.000Z',
    ...overrides,
  };
}

const DRAFT: LegalDraft = {
  id: DRAFT_ID,
  kind: 'PRIVACY_POLICY',
  status: 'PENDING_APPROVAL',
  revision: 2,
  basedOnVersionId: 'privacy-2026-11-20',
  authorAccountId: OTHER,
  content: {
    kind: 'PRIVACY_POLICY',
    contentSchemaVersion: 1,
    title: '개인정보 처리방침',
    summaryItems: [],
    sections: [
      { type: 'heading', level: 2, text: '제1조(보유 기간)' },
      { type: 'paragraph', text: '접속 기록은 3년 보관합니다.' },
    ],
    changeSummary: '접속 기록 보관 기간을 고칩니다.',
    noticeClass: 'GENERAL',
    consentRequired: false,
    proposedEffectiveDate: '2026-12-10',
    appliesUntil: null,
  },
  contentDigest: DIGEST,
  createdAt: '2026-11-25T00:30:00.000Z',
  updatedAt: '2026-11-25T00:50:00.000Z',
};

const PREVIOUS: LegalBackofficeVersion = {
  id: 'privacy-2026-11-20',
  kind: 'PRIVACY_POLICY',
  version: 'privacy-2026-11-20',
  title: '개인정보 처리방침',
  changeSummary: '첫 게시',
  noticeClass: 'INITIAL',
  consentRequired: false,
  effectiveDate: '2026-11-20',
  appliesUntil: null,
  contentDigest: 'e'.repeat(64),
  publishedAt: '2026-11-20T00:00:00.000Z',
  withdrawnAt: null,
  requestedByAccountId: null,
  approvedByAccountId: null,
  selfApproved: false,
};

function detail(overrides: Partial<LegalRequestDetail> = {}): LegalRequestDetail {
  return {
    request: request(),
    draft: DRAFT,
    version: null,
    previousVersion: PREVIOUS,
    comparison: [
      {
        heading: '제1조(보유 기간)',
        change: 'changed',
        before: [
          { type: 'heading', level: 2, text: '제1조(보유 기간)' },
          { type: 'paragraph', text: '접속 기록은 3개월 보관합니다.' },
        ],
        after: [
          { type: 'heading', level: 2, text: '제1조(보유 기간)' },
          { type: 'paragraph', text: '접속 기록은 3년 보관합니다.' },
        ],
      },
    ],
    check: { ok: true },
    ...overrides,
  };
}

function renderScreen(selected: LegalRequestDetail, requests: LegalRequest[] = [selected.request]) {
  render(
    <LegalRequestsScreen
      requests={requests}
      selected={selected}
      accounts={null}
      selfAccountId={SELF}
      canEdit
      canApprove
      status="PENDING"
      nextPage={null}
    />,
  );
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function decided(selfApproved = false) {
  return respond(200, {
    request: request({ status: 'APPROVED', decidedByAccountId: SELF, selfApproved }),
    version: null,
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  router.push.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  search.params = new URLSearchParams();
  browser.startAuthentication.mockReset();
});

describe('LegalRequestsScreen', () => {
  it('opens approve only after the approver marks the comparison as read', async () => {
    fetchMock.mockResolvedValue(decided());
    renderScreen(detail());
    const region = screen.getByRole('region', { name: '게시 요청 · 개인정보 처리방침' });
    expect(within(region).getByRole('table', { name: '조항 대조표' })).toHaveTextContent(
      '접속 기록은 3년 보관합니다.',
    );
    const decision = within(region).getByRole('form', { name: /결정$/u });
    const approve = within(decision).getByRole('button', { name: '승인' });
    expect(approve).toBeDisabled();
    await userEvent.click(
      within(decision).getByRole('checkbox', {
        name: '대조표와 고지 등급·시행일을 확인했습니다',
      }),
    );
    expect(approve).toBeEnabled();
    await userEvent.click(approve);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(APPROVE_URL);
    expect(JSON.parse(String(init!.body))).toEqual({ contentDigest: DIGEST });
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 승인했습니다.');
    // Chosen as the list's first request: the page reads it again by its id, past the status filter (no auto next).
    expect(router.replace).toHaveBeenCalledWith(
      `/legal/requests?status=PENDING&request=${REQUEST_ID}`,
      { scroll: false },
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('shows the summary items and a changed title next to the comparison, which compares sections only', () => {
    renderScreen(
      detail({
        draft: {
          ...DRAFT,
          content: {
            ...DRAFT.content,
            title: '개인정보 처리방침(개정)',
            summaryItems: ['접속 기록을 3년 보관합니다.'],
          },
        },
      }),
    );
    const region = screen.getByRole('region', { name: '게시 요청 · 개인정보 처리방침' });
    expect(within(region).getByRole('list', { name: '요약 항목' })).toBeVisible();
    expect(within(region).getByRole('list', { name: '요약 항목' })).toHaveTextContent(
      '접속 기록을 3년 보관합니다.',
    );
    // The title also stands in the closed whole text; the facts list shows it first.
    expect(within(region).getAllByText('개인정보 처리방침(개정)')[0]).toBeVisible();
    expect(within(region).getByText('앞 판과 다름: 개인정보 처리방침')).toBeVisible();
  });

  it('keeps the decision closed after a decision until the page reads it again, and focuses the result', async () => {
    fetchMock.mockResolvedValue(decided());
    renderScreen(detail());
    const region = screen.getByRole('region', { name: '게시 요청 · 개인정보 처리방침' });
    const decision = within(region).getByRole('form', { name: /결정$/u });
    await userEvent.click(
      within(decision).getByRole('checkbox', {
        name: '대조표와 고지 등급·시행일을 확인했습니다',
      }),
    );
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));
    const result = await screen.findByText('요청을 승인했습니다.');
    expect(within(decision).getByRole('button', { name: '승인' })).toBeDisabled();
    expect(within(decision).getByRole('button', { name: '거절' })).toBeDisabled();
    await waitFor(() => expect(result.closest('[role="status"]')).toHaveFocus());
  });

  it('reads the decided request again where the query already names it', async () => {
    search.params = new URLSearchParams({ status: 'PENDING', request: REQUEST_ID });
    fetchMock.mockResolvedValue(respond(200, request({ status: 'CANCELLED' })));
    renderScreen(detail({ request: request({ requestedByAccountId: SELF }) }));
    await userEvent.click(screen.getByRole('button', { name: '요청 취소' }));
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 취소했습니다.');
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the whole text where no version comes before, and still asks for the mark', async () => {
    renderScreen(
      detail({
        previousVersion: null,
        comparison: [],
        draft: { ...DRAFT, content: { ...DRAFT.content, noticeClass: 'INITIAL' } },
      }),
    );
    const region = screen.getByRole('region', { name: '게시 요청 · 개인정보 처리방침' });
    expect(region).toHaveTextContent('앞 판이 없어 대조표가 없습니다.');
    expect(within(region).getByRole('article', { name: '본문 전체' })).toHaveTextContent(
      '접속 기록은 3년 보관합니다.',
    );
    const decision = within(region).getByRole('form', { name: /결정$/u });
    expect(within(decision).getByRole('button', { name: '승인' })).toBeDisabled();
    await userEvent.click(
      within(decision).getByRole('checkbox', {
        name: '본문 전체와 고지 등급·시행일을 확인했습니다',
      }),
    );
    expect(within(decision).getByRole('button', { name: '승인' })).toBeEnabled();
  });

  it('keeps approve closed while the checks refuse as of now, and still lets the approver reject', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        request: request({
          status: 'REJECTED',
          decidedByAccountId: SELF,
          decisionReason: '시행일',
        }),
        version: null,
      }),
    );
    renderScreen(detail({ check: { ok: false, reason: 'notice_too_short' } }));
    const region = screen.getByRole('region', { name: '게시 요청 · 개인정보 처리방침' });
    expect(region).toHaveTextContent(
      '시행일이 공지 기간보다 이릅니다. 일반은 승인일 + 7일, 중대는 승인일 + 30일부터입니다.',
    );
    const decision = within(region).getByRole('form', { name: /결정$/u });
    await userEvent.click(
      within(decision).getByRole('checkbox', {
        name: '대조표와 고지 등급·시행일을 확인했습니다',
      }),
    );
    expect(within(decision).getByRole('button', { name: '승인' })).toBeDisabled();
    await userEvent.type(
      within(decision).getByRole('textbox', { name: '결정 사유(거절할 때 필수)' }),
      '시행일이 너무 이름',
    );
    await userEvent.click(within(decision).getByRole('button', { name: '거절' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe(REJECT_URL);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({
      contentDigest: DIGEST,
      reason: '시행일이 너무 이름',
    });
  });

  it('asks the only approver for a reason and a passkey before approving their own request', async () => {
    const mine = detail({ request: request({ requestedByAccountId: SELF }) });
    fetchMock
      .mockResolvedValueOnce(respond(403, { error: { code: 'reauthentication_required' } }))
      .mockResolvedValueOnce(
        respond(200, { challengeId: OTHER, options: { challenge: 'c'.repeat(43) } }),
      )
      .mockResolvedValueOnce(respond(200, { reauthenticatedUntil: '2026-11-25T01:05:00.000Z' }))
      .mockResolvedValueOnce(decided(true));
    browser.startAuthentication.mockResolvedValue({ id: 'cred' });
    renderScreen(mine);
    const decision = screen.getByRole('form', { name: /결정$/u });
    const reason = within(decision).getByRole('textbox', { name: '자기 승인 사유(필수)' });
    expect(reason).toBeRequired();
    expect(within(decision).queryByRole('button', { name: '거절' })).toBeNull();
    await userEvent.click(
      within(decision).getByRole('checkbox', {
        name: '대조표와 고지 등급·시행일을 확인했습니다',
      }),
    );
    reason.removeAttribute('required');
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));
    expect(await within(decision).findByRole('alert')).toHaveTextContent(
      '자기 승인 사유를 적으세요.',
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(reason, '승인 권한 운영자가 한 명뿐임');
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 승인했습니다.');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      APPROVE_URL,
      '/api/auth/reauthentication/options',
      '/api/auth/reauthentication',
      APPROVE_URL,
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[3]![1]!.body))).toEqual({
      contentDigest: DIGEST,
      reason: '승인 권한 운영자가 한 명뿐임',
    });
    expect(browser.startAuthentication).toHaveBeenCalledTimes(1);
  });

  it('shows a closed request as it is now, without a decision area', () => {
    renderScreen(
      detail({
        request: request({ status: 'APPROVED', decidedByAccountId: SELF }),
        draft: { ...DRAFT, status: 'PUBLISHED' },
        check: null,
      }),
    );
    const region = screen.getByRole('region', { name: '게시 요청 · 개인정보 처리방침' });
    expect(within(region).queryByRole('form', { name: /결정$/u })).toBeNull();
    expect(region).toHaveTextContent('닫힌 요청입니다. 대상은 지금 상태로 보입니다.');
  });

  it('chooses a request through the query and keeps the status filter', async () => {
    renderScreen(detail(), [request(), request({ id: SECOND_ID })]);
    const list = screen.getByRole('list', { name: '요청 목록' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
    await userEvent.click(buttons[1]!);
    expect(router.push).toHaveBeenCalledWith(
      `/legal/requests?status=PENDING&request=${SECOND_ID}`,
      { scroll: false },
    );
  });
});
