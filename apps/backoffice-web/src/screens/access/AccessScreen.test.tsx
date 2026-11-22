import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessRequest } from '@repo/shared/backoffice';
import { AccessScreen } from './AccessScreen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const browser = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => browser);

const SELF = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const OTHER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const REQUEST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const APPROVE_URL = `/api/access/requests/${REQUEST_ID}/approve`;
const fetchMock = vi.fn<typeof fetch>();

function request(overrides: Partial<AccessRequest>): AccessRequest {
  return {
    id: REQUEST_ID,
    kind: 'ROLE_GRANT',
    status: 'PENDING',
    contentDigest: 'd'.repeat(64),
    targetAccountId: OTHER,
    targetRole: 'AUDITOR',
    requestedByAccountId: SELF,
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

function renderScreen(requests: AccessRequest[]) {
  render(
    <AccessScreen
      requests={requests}
      roles={[{ role: 'AUDITOR', permissions: ['admin:audit:read'] }]}
      accounts={null}
      selfAccountId={SELF}
      canRequest
      canApprove
      status={null}
      nextPage={null}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
});

describe('AccessScreen (OA-R9)', () => {
  it('asks for a reason before the requester approves their own request, and sends the shown digest', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(request({ status: 'APPROVED', selfApproved: true })), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderScreen([request({})]);
    const decision = screen.getByRole('form', { name: /결정$/u });
    const reason = within(decision).getByRole('textbox', { name: '자기 승인 사유(필수)' });
    expect(reason).toBeRequired();
    expect(within(decision).queryByRole('button', { name: '거절' })).toBeNull();
    await userEvent.type(reason, '승인 권한 운영자가 한 명뿐임');
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(APPROVE_URL);
    expect(JSON.parse(String(init!.body))).toEqual({
      contentDigest: 'd'.repeat(64),
      reason: '승인 권한 운영자가 한 명뿐임',
    });
  });

  it("refuses a rejection without a reason before calling the BFF on another operator's request", async () => {
    renderScreen([request({ requestedByAccountId: OTHER })]);
    const decision = screen.getByRole('form', { name: /결정$/u });
    expect(
      within(decision).getByRole('textbox', { name: '결정 사유(거절할 때 필수)' }),
    ).not.toBeRequired();
    await userEvent.click(within(decision).getByRole('button', { name: '거절' }));
    expect(await within(decision).findByRole('alert')).toHaveTextContent('거절 사유를 적으세요.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs the passkey re-authentication once when the API asks for it, then retries', async () => {
    const respond = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    fetchMock
      .mockResolvedValueOnce(respond(403, { error: { code: 'reauthentication_required' } }))
      .mockResolvedValueOnce(
        respond(200, { challengeId: OTHER, options: { challenge: 'c'.repeat(43) } }),
      )
      .mockResolvedValueOnce(respond(200, { reauthenticatedUntil: '2026-11-22T04:05:00.000Z' }))
      .mockResolvedValueOnce(
        respond(200, request({ status: 'APPROVED', decidedByAccountId: SELF })),
      );
    browser.startAuthentication.mockResolvedValue({ id: 'cred' });
    renderScreen([request({ requestedByAccountId: OTHER })]);
    const decision = screen.getByRole('form', { name: /결정$/u });
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));
    expect(await screen.findByRole('status')).toHaveTextContent('요청을 승인했습니다.');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      APPROVE_URL,
      '/api/auth/reauthentication/options',
      '/api/auth/reauthentication',
      APPROVE_URL,
    ]);
    expect(browser.startAuthentication).toHaveBeenCalledTimes(1);
  });
});
