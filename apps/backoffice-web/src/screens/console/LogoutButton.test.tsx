import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoutButton } from './LogoutButton';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
});

describe('LogoutButton', () => {
  it('goes to the login page after a confirmed logout', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('tells the operator when the API could not confirm it', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'upstream_unavailable' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?ended=unconfirmed'));
  });
});
