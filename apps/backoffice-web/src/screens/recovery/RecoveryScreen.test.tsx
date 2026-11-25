import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoveryScreen } from './RecoveryScreen';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const browser = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => browser);

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
});

describe('RecoveryScreen (OA-R2)', () => {
  it('keeps the result paragraph for the same error on an auth screen', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'session_required' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<RecoveryScreen displayName="시험 운영자" />);
    await userEvent.click(screen.getByRole('button', { name: '새 passkey 등록' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 로그인하세요.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: '다시 로그인' })).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/passkeys/options']);
    expect(browser.startRegistration).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
