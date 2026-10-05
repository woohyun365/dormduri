import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MainRouteShell from '../MainRouteShell.client';
import { authApi } from '@/auth/api';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/auth/api', () => ({ authApi: { resolveSession: vi.fn() } }));
vi.mock('@/main/runtime/MainRuntime', () => ({
  MainRuntime: ({ children, viewerId }: { children: React.ReactNode; viewerId: string }) => {
    const [draft, setDraft] = React.useState('');
    return (
      <div data-testid="main" data-viewer={viewerId}>
        {children}
        <input
          aria-label="private draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
    );
  },
}));

const resolveSession = vi.mocked(authApi.resolveSession);
const dashboard = createHomeDashboardTestResponse();
const ready = { status: 'ready' as const, viewerId: dashboard.viewer.identity.user.id, dashboard };

function shell(bootstrap: Parameters<typeof MainRouteShell>[0]['bootstrap']) {
  return (
    <MainRouteShell bootstrap={bootstrap}>
      <span>meaningful route child</span>
    </MainRouteShell>
  );
}

describe('MainRouteShell server bootstrap boundary', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    resolveSession.mockReset();
  });

  it('renders the server-seeded private runtime immediately without a client auth/loading gate', () => {
    render(shell(ready));
    expect(screen.getByTestId('main')).toHaveAttribute('data-viewer', ready.viewerId);
    expect(screen.getByText('meaningful route child')).toBeInTheDocument();
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('automatically resolves recovery once across a router refresh and repeated recovery props', async () => {
    resolveSession.mockResolvedValue({
      status: 'authenticated',
      user: dashboard.viewer.identity.user,
    });
    const view = render(shell({ status: 'session-recovery-required' }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(resolveSession).toHaveBeenCalledTimes(1);
    view.rerender(shell({ status: 'session-recovery-required' }));
    await Promise.resolve();
    expect(resolveSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '로그인 상태 다시 확인' })).toBeInTheDocument();
  });

  it('redirects only after the response-capable recovery BFF confirms unauthenticated', async () => {
    resolveSession.mockResolvedValue({ status: 'unauthenticated' });
    render(shell({ status: 'session-recovery-required' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('keeps unavailable failures token-free and supports explicit retry', async () => {
    resolveSession.mockResolvedValue({ status: 'unavailable', code: 'AUTH_SESSION_UNAVAILABLE' });
    render(shell({ status: 'session-recovery-required' }));
    await waitFor(() => expect(resolveSession).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '로그인 상태 다시 확인' }));
    await waitFor(() => expect(resolveSession).toHaveBeenCalledTimes(2));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('does not navigate when an in-flight recovery resolves after the shell unmounts', async () => {
    let recoverySignal: AbortSignal | undefined;
    let finish: ((value: Awaited<ReturnType<typeof authApi.resolveSession>>) => void) | undefined;
    resolveSession.mockImplementation(
      (signal) =>
        new Promise((resolve) => {
          recoverySignal = signal;
          finish = resolve;
        }),
    );
    const view = render(shell({ status: 'session-recovery-required' }));
    await waitFor(() => expect(resolveSession).toHaveBeenCalledTimes(1));
    view.unmount();
    await waitFor(() => expect(recoverySignal?.aborted).toBe(true));
    finish?.({ status: 'authenticated', user: dashboard.viewer.identity.user });
    await Promise.resolve();
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('aborts an in-flight recovery when a newer server bootstrap supersedes it', async () => {
    let recoverySignal: AbortSignal | undefined;
    resolveSession.mockImplementation(
      (signal) =>
        new Promise(() => {
          recoverySignal = signal;
        }),
    );
    const view = render(shell({ status: 'session-recovery-required' }));
    await waitFor(() => expect(resolveSession).toHaveBeenCalledTimes(1));

    view.rerender(shell({ status: 'session-unavailable' }));

    await waitFor(() => expect(recoverySignal?.aborted).toBe(true));
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('retries server-only unavailable reads with router.refresh without invoking browser renewal', () => {
    render(shell({ status: 'session-unavailable' }));
    fireEvent.click(screen.getByRole('button', { name: '로그인 상태 다시 확인' }));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('keys private client state by viewer only and discards it for unknown auth or another viewer', () => {
    const view = render(shell(ready));
    fireEvent.change(screen.getByLabelText('private draft'), { target: { value: 'viewer-a' } });
    view.rerender(shell({ status: 'dashboard-unavailable', viewerId: ready.viewerId }));
    expect(screen.getByLabelText('private draft')).toHaveValue('viewer-a');
    view.rerender(shell({ status: 'session-unavailable' }));
    expect(screen.queryByLabelText('private draft')).not.toBeInTheDocument();
    const otherDashboard = structuredClone(dashboard);
    otherDashboard.viewer.identity.user.id = 'viewer-b';
    view.rerender(shell({ status: 'ready', viewerId: 'viewer-b', dashboard: otherDashboard }));
    expect(screen.getByLabelText('private draft')).toHaveValue('');
  });
});
