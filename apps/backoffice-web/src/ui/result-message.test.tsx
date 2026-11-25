import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessRequest } from '@repo/shared/backoffice';
import { AccessScreen } from '@/screens/access/AccessScreen';
import { ConsoleFrame } from '@/screens/console/ConsoleFrame';
import { NAVIGATION } from '@/screens/console/navigation';
import { SessionEndNotice } from '@/screens/console/SessionEndNotice';
import { SecurityScreen } from '@/screens/security/SecurityScreen';
import { useFailure } from './result-message';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/access',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

const fetchMock = vi.fn<typeof fetch>();
const REQUEST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const SELF = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const pending: AccessRequest = {
  id: REQUEST_ID,
  kind: 'ROLE_GRANT',
  status: 'PENDING',
  contentDigest: 'd'.repeat(64),
  targetAccountId: OTHER,
  targetRole: 'AUDITOR',
  requestedByAccountId: OTHER,
  requestReason: null,
  expiresAt: '2026-11-29T04:00:00.000Z',
  decidedByAccountId: null,
  closedAt: null,
  decisionReason: null,
  selfApproved: false,
  createdAt: '2026-11-22T04:00:00.000Z',
};

function answer(status: number, code: string) {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function inShell(screenNode: ReactNode) {
  return (
    <ConsoleFrame
      groups={NAVIGATION}
      user={{ name: '시험 운영자', roles: 'owner' }}
      logout={null}
      notice={
        <SessionEndNotice
          idleRemainingMs={15 * 60 * 1000}
          absoluteRemainingMs={8 * 60 * 60 * 1000}
        />
      }
    >
      {screenNode}
    </ConsoleFrame>
  );
}

/** The access screen inside the console frame with the shell's ended-session notice, as the (console) layout draws it. */
function renderInShell() {
  render(
    inShell(
      <AccessScreen
        requests={[pending]}
        roles={[{ role: 'AUDITOR', permissions: ['admin:audit:read'] }]}
        accounts={null}
        selfAccountId={SELF}
        canRequest
        canApprove
        status={null}
        nextPage={null}
      />,
    ),
  );
}

function FailureRole({ code }: { readonly code: 'session_required' | 'conflict' }) {
  const failure = useFailure()(code);
  return <p>{failure.role}</p>;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
});

describe('result paragraph roles (README §4)', () => {
  it("reads a closed session's failure in the console after the shell's notice, as a status", async () => {
    fetchMock.mockResolvedValue(answer(401, 'session_required'));
    renderInShell();
    const decision = screen.getByRole('form', { name: /결정$/u });
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));

    // The shell's notice is the one alert; the paragraph keeps its words and its place in the decision area.
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(screen.getByRole('alert')).toHaveTextContent('이 접속은 끝났습니다.');
    expect(within(decision).getByRole('status')).toHaveTextContent('다시 로그인하세요.');
    expect(within(decision).queryByRole('alert')).toBeNull();
  });

  it("reads a closed session's TOTP confirmation failure on 내 보안 설정 after the shell's notice, as a status", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/dormduri:owner' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(answer(401, 'session_required'));
    render(inShell(<SecurityScreen passkeyCount={1} totpConfirmed recoveryCodesRemaining={8} />));
    await userEvent.click(screen.getByRole('button', { name: 'TOTP 새로 발급' }));
    const confirm = await screen.findByRole('form', { name: 'TOTP 확인' });
    await userEvent.type(within(confirm).getByRole('textbox'), '123456');
    await userEvent.click(within(confirm).getByRole('button', { name: 'TOTP 확인' }));

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(screen.getByRole('alert')).toHaveTextContent('이 접속은 끝났습니다.');
    // TOTP 확인's own paragraph keeps its words below the form; only its role changes.
    expect(within(confirm.parentElement!).getByText(/다시 로그인하세요/u)).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('keeps any other failure in the console an alert', async () => {
    fetchMock.mockResolvedValue(answer(409, 'conflict'));
    renderInShell();
    const decision = screen.getByRole('form', { name: /결정$/u });
    await userEvent.click(within(decision).getByRole('button', { name: '승인' }));

    expect(await within(decision).findByRole('alert')).toHaveTextContent(
      '이미 처리됐거나 지금 상태에서는 할 수 없는 작업입니다.',
    );
  });

  it('keeps a closed session an alert outside the console, where no shell notice is read', () => {
    render(<FailureRole code="session_required" />);
    expect(screen.getByText('alert')).toBeInTheDocument();
  });
});
