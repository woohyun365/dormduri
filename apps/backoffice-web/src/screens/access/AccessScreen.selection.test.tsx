import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessRequest } from '@repo/shared/backoffice';
import { AccessScreen } from './AccessScreen';

// The chosen request of the master-detail (design guide ④): screen state that stays on the request the operator acted
// on, a fresh choice when the status filter shows another list, and a move to the detail where it sits below the list.

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

const SELF = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const OTHER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const THEIRS = '0f8fad5b-d9cb-469f-a165-70867728950e';
const MINE = '9b2d1c3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e';
const fetchMock = vi.fn<typeof fetch>();

function request(id: string, overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id,
    kind: 'ROLE_GRANT',
    status: 'PENDING',
    contentDigest: 'd'.repeat(64),
    targetAccountId: OTHER,
    targetRole: 'AUDITOR',
    requestedByAccountId: id === MINE ? SELF : OTHER,
    requestReason: null,
    expiresAt: '2026-11-29T04:00:00.000Z',
    decidedByAccountId: null,
    closedAt: null,
    decisionReason: null,
    selfApproved: false,
    createdAt: '2026-11-22T04:00:00.000Z',
    ...overrides,
  };
}

function screenFor(requests: AccessRequest[], status: AccessRequest['status'] | null = 'PENDING') {
  return (
    <AccessScreen
      requests={requests}
      roles={[{ role: 'AUDITOR', permissions: ['admin:audit:read'] }]}
      accounts={null}
      selfAccountId={SELF}
      canRequest
      canApprove
      status={status}
      nextPage={null}
    />
  );
}

function ok(body: AccessRequest) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** The detail section; its caption names the request by the first eight characters of its id. */
function detail() {
  return screen.getByRole('region', { name: /·/u });
}

/** My request's button in the list (its head says 내 요청). */
function myItem() {
  const list = screen.getByRole('list', { name: '요청 목록' });
  return within(list)
    .getAllByRole('button')
    .find((button) => button.textContent?.includes('· 내 요청'))!;
}

function narrowScreen(narrow: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: narrow && query === '(width < 64rem)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  narrowScreen(false);
});

afterEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
});

describe('AccessScreen selection', () => {
  it('keeps a cancelled request chosen when the refreshed pending list no longer holds it', async () => {
    const theirs = request(THEIRS);
    const mine = request(MINE);
    fetchMock.mockResolvedValue(
      ok({ ...mine, status: 'CANCELLED', closedAt: '2026-11-22T05:00:00.000Z' }),
    );
    const view = render(screenFor([theirs, mine]));
    await userEvent.click(myItem());
    await userEvent.click(within(detail()).getByRole('button', { name: '요청 취소' }));
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 취소했습니다.');

    view.rerender(screenFor([theirs]));
    expect(within(detail()).getByText(`요청 ${MINE.slice(0, 8)}`)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: /결정$/u })).toBeNull();
  });

  it('shows the decided request, not the list copy waiting for the refresh, right after a decision', async () => {
    const theirs = request(THEIRS);
    fetchMock.mockResolvedValue(ok({ ...theirs, status: 'APPROVED', decidedByAccountId: SELF }));
    render(screenFor([theirs]));
    const decision = screen.getByRole('form', { name: /결정$/u });
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 승인했습니다.');

    // router.refresh has not answered: the list still holds the pending copy.
    expect(screen.queryByRole('form', { name: /결정$/u })).toBeNull();
    expect(within(detail()).getByText(`요청 ${THEIRS.slice(0, 8)}`)).toBeInTheDocument();
  });

  it('keeps the result after the refresh and drops it when the status filter shows another list', async () => {
    const theirs = request(THEIRS);
    const approvedCopy = { ...theirs, status: 'APPROVED' as const, decidedByAccountId: SELF };
    fetchMock.mockResolvedValue(ok(approvedCopy));
    const view = render(screenFor([theirs], 'PENDING'));
    await userEvent.click(
      within(screen.getByRole('form', { name: /결정$/u })).getByRole('button', { name: '승인' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 승인했습니다.');

    view.rerender(screenFor([], 'PENDING'));
    expect(screen.getByRole('status')).toHaveTextContent('요청을 승인했습니다.');

    view.rerender(screenFor([approvedCopy, request(MINE, { status: 'APPROVED' })], 'APPROVED'));
    await waitFor(() => expect(screen.queryByText('요청을 승인했습니다.')).toBeNull());
    expect(within(detail()).getByText(`요청 ${THEIRS.slice(0, 8)}`)).toBeInTheDocument();
  });

  it('moves focus to the chosen detail below the list on a narrow screen', async () => {
    narrowScreen(true);
    render(screenFor([request(THEIRS), request(MINE)]));
    await userEvent.click(myItem());
    const heading = within(detail()).getByRole('heading', { level: 2 });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(within(detail()).getByText(`요청 ${MINE.slice(0, 8)}`)).toBeInTheDocument();
  });

  it('leaves focus on the list beside the detail on a wide screen', async () => {
    render(screenFor([request(THEIRS), request(MINE)]));
    const item = myItem();
    await userEvent.click(item);
    expect(within(detail()).getByText(`요청 ${MINE.slice(0, 8)}`)).toBeInTheDocument();
    expect(item).toHaveFocus();
  });
});
