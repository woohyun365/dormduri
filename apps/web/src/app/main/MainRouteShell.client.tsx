'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SessionUnavailableRecovery } from '@/app/main/components/SessionUnavailableRecovery';
import { authApi } from '@/auth/api';
import { MainRuntime } from '@/main/runtime/MainRuntime';
import type { MainLayoutBootstrap } from '@/main/server/readMainLayoutBootstrap';

const RECOVERY_TIMEOUT_MS = 3_000;

export default function MainRouteShell({
  bootstrap,
  children,
}: {
  bootstrap: MainLayoutBootstrap;
  children: ReactNode;
}) {
  const router = useRouter();
  const automaticRecoveryAttempted = useRef(false);
  const recoveryInFlight = useRef(false);
  const recoveryController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const lifecycleGeneration = useRef(0);
  const bootstrapStatus = useRef(bootstrap.status);

  useEffect(() => {
    lifecycleGeneration.current += 1;
    mounted.current = true;
    return () => {
      mounted.current = false;
      const cleanupGeneration = (lifecycleGeneration.current += 1);
      queueMicrotask(() => {
        if (lifecycleGeneration.current !== cleanupGeneration || mounted.current) return;
        recoveryController.current?.abort();
        recoveryController.current = null;
      });
    };
  }, []);

  useEffect(() => {
    bootstrapStatus.current = bootstrap.status;
    if (bootstrap.status !== 'session-recovery-required') {
      recoveryController.current?.abort();
      recoveryController.current = null;
      recoveryInFlight.current = false;
    }
  }, [bootstrap]);

  const recoverSession = useCallback(async () => {
    if (recoveryInFlight.current) return;
    recoveryInFlight.current = true;
    const controller = new AbortController();
    recoveryController.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), RECOVERY_TIMEOUT_MS);
    try {
      const resolution = await authApi.resolveSession(controller.signal);
      if (!mounted.current || bootstrapStatus.current !== 'session-recovery-required') return;
      if (resolution.status === 'authenticated') router.refresh();
      else if (resolution.status === 'unauthenticated') router.replace('/login');
    } catch {
      // The token-free recovery shell remains available for an explicit retry.
    } finally {
      clearTimeout(timeoutId);
      if (recoveryController.current === controller) {
        recoveryController.current = null;
        recoveryInFlight.current = false;
      }
    }
  }, [router]);

  useEffect(() => {
    if (bootstrap.status === 'ready') {
      automaticRecoveryAttempted.current = false;
      return;
    }
    if (bootstrap.status !== 'session-recovery-required') return;
    if (automaticRecoveryAttempted.current) return;
    automaticRecoveryAttempted.current = true;
    void recoverSession();
  }, [bootstrap.status, recoverSession]);

  if (
    bootstrap.status === 'session-recovery-required' ||
    bootstrap.status === 'session-unavailable'
  ) {
    return (
      <SessionUnavailableRecovery
        onRetryAction={
          bootstrap.status === 'session-recovery-required'
            ? () => void recoverSession()
            : () => router.refresh()
        }
      />
    );
  }

  return (
    <MainRuntime
      key={bootstrap.viewerId}
      viewerId={bootstrap.viewerId}
      initialDashboard={bootstrap.status === 'ready' ? bootstrap.dashboard : null}
      dashboardUnavailable={bootstrap.status === 'dashboard-unavailable'}
      resourceSnapshot={bootstrap}
    >
      {children}
    </MainRuntime>
  );
}
