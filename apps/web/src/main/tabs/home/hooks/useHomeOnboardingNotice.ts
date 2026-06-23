import { useCallback, useState } from 'react';
import { SERVICE_INTRO_NOTICE_KEY, type DismissedNoticeState } from '@repo/shared/user';
import { currentUserApi } from '@/api/current-user';
import type { HomeDashboardResponse } from '@repo/shared/home';

const DISMISS_ERROR_MESSAGE =
  '안내 상태를 저장하지 못했어요. 잠시 후 다시 시도하거나 나중에 다시 닫아주세요.';

interface UseHomeOnboardingNoticeInput {
  dashboard: HomeDashboardResponse;
  onDismissed?: () => Promise<void> | void;
}

export interface UseHomeOnboardingNoticeResult {
  isOpen: boolean;
  dismissing: boolean;
  error: string | null;
  closeForNow: () => void;
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
  const [closedForNow, setClosedForNow] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeForNow = useCallback(() => {
    setClosedForNow(true);
    setError(null);
  }, []);

  const dismissPermanently = useCallback(async () => {
    setDismissing(true);
    setError(null);
    try {
      await currentUserApi.dismissOnboardingNotice({ noticeKey: SERVICE_INTRO_NOTICE_KEY });
      setClosedForNow(true);
      await onDismissed?.();
    } catch {
      setError(DISMISS_ERROR_MESSAGE);
    } finally {
      setDismissing(false);
    }
  }, [onDismissed]);

  return {
    isOpen: !accountDismissed && !closedForNow,
    dismissing,
    error,
    closeForNow,
    dismissPermanently,
  };
}
