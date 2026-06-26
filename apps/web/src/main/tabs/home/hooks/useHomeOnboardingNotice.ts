import { useCallback, useEffect, useState } from 'react';
import { SERVICE_INTRO_NOTICE_KEY, type DismissedNoticeState } from '@repo/shared/user';
import { homeOnboardingNoticeApi } from '@/main/tabs/home/api/home-onboarding-notice.api';
import type { HomeDashboardResponse } from '@repo/shared/home';

const DISMISS_ERROR_MESSAGE =
  '안내 상태를 저장하지 못했어요. 잠시 후 다시 시도하거나 나중에 다시 닫아주세요.';
const TODAY_DISMISS_STORAGE_KEY_PREFIX = 'home-service-intro-notice-dismissed-until';
const SESSION_DISMISS_STORAGE_KEY_PREFIX = 'home-service-intro-notice-session-dismissed';

interface TodayDismissStorageValue {
  expiresAt: number;
}

interface UseHomeOnboardingNoticeInput {
  dashboard: HomeDashboardResponse;
  onDismissed?: () => Promise<void> | void;
}

export interface UseHomeOnboardingNoticeResult {
  isOpen: boolean;
  dismissing: boolean;
  error: string | null;
  dismissForSession: () => void;
  dismissForToday: () => void;
  openManually: () => void;
  dismissPermanently: () => Promise<void>;
}

export function isServiceIntroNoticeDismissed(notices: DismissedNoticeState[]): boolean {
  return notices.some(
    (notice) => notice.noticeKey === SERVICE_INTRO_NOTICE_KEY && notice.dismissed,
  );
}

export function useHomeOnboardingNotice({
  dashboard,
  onDismissed,
}: UseHomeOnboardingNoticeInput): UseHomeOnboardingNoticeResult {
  const accountDismissed = isServiceIntroNoticeDismissed(
    dashboard.viewer.onboarding.dismissedNotices,
  );
  const userId = dashboard.viewer.identity.user.id;
  const todayDismissStorageKey = buildTodayDismissStorageKey(userId);
  const sessionDismissStorageKey = buildSessionDismissStorageKey(userId);
  const [dismissedForToday, setDismissedForToday] = useState(() =>
    readTodayDismissed(todayDismissStorageKey),
  );
  const [dismissedForSession, setDismissedForSession] = useState(() =>
    readSessionDismissed(sessionDismissStorageKey),
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDismissedForToday(readTodayDismissed(todayDismissStorageKey));
    setDismissedForSession(readSessionDismissed(sessionDismissStorageKey));

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== todayDismissStorageKey) return;
      setDismissedForToday(readTodayDismissed(todayDismissStorageKey));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [sessionDismissStorageKey, todayDismissStorageKey]);

  const dismissForSession = useCallback(() => {
    writeSessionDismissed(sessionDismissStorageKey);
    setDismissedForSession(true);
    setManualOpen(false);
    setError(null);
  }, [sessionDismissStorageKey]);

  const dismissForToday = useCallback(() => {
    writeTodayDismissed(todayDismissStorageKey);
    setDismissedForToday(true);
    setManualOpen(false);
    setError(null);
  }, [todayDismissStorageKey]);

  const openManually = useCallback(() => {
    setManualOpen(true);
    setError(null);
  }, []);

  const dismissPermanently = useCallback(async () => {
    setDismissing(true);
    setError(null);
    try {
      await homeOnboardingNoticeApi.dismissServiceIntroNotice();
    } catch {
      setError(DISMISS_ERROR_MESSAGE);
      setDismissing(false);
      return;
    }

    writeTodayDismissed(todayDismissStorageKey);
    setDismissedForToday(true);
    setManualOpen(false);
    setDismissing(false);

    try {
      await onDismissed?.();
    } catch {
      // 저장은 이미 성공했으므로 refetch 실패를 dismiss 실패로 오해시키지 않는다.
    }
  }, [onDismissed, todayDismissStorageKey]);

  return {
    isOpen: manualOpen || (!accountDismissed && !dismissedForToday && !dismissedForSession),
    dismissing,
    error,
    dismissForSession,
    dismissForToday,
    openManually,
    dismissPermanently,
  };
}

function buildTodayDismissStorageKey(userId: string): string {
  return `${TODAY_DISMISS_STORAGE_KEY_PREFIX}:${userId}`;
}

function buildSessionDismissStorageKey(userId: string): string {
  return `${SESSION_DISMISS_STORAGE_KEY_PREFIX}:${userId}`;
}

function readSessionDismissed(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

function writeSessionDismissed(storageKey: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(storageKey, 'true');
  } catch {
    // sessionStorage를 사용할 수 없는 환경에서는 현재 렌더 트리의 state만으로 닫힘을 유지한다.
  }
}

function readTodayDismissed(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return false;

    const value = JSON.parse(rawValue) as Partial<TodayDismissStorageValue>;
    if (typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) {
      window.localStorage.removeItem(storageKey);
      return false;
    }

    if (value.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function writeTodayDismissed(storageKey: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ expiresAt: resolveNextLocalMidnightTimestamp() }),
    );
  } catch {
    // localStorage를 사용할 수 없는 환경에서는 현재 렌더 트리의 state만으로 닫힘을 유지한다.
  }
}

function resolveNextLocalMidnightTimestamp(now = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime();
}
