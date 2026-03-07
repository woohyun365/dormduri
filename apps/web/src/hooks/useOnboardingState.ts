import { useState, useCallback, useEffect } from 'react';

/**
 * 온보딩 상태 관리 훅
 *
 * 현재는 localStorage에 저장한다.
 * 추후 서버 연동 시 이 훅 내부만 수정하면 된다.
 * (localStorage → GET/PATCH /api/user/onboarding)
 */

const STORAGE_KEY = 'onboarding';

interface OnboardingState {
  /** 건물별 가이드 표시 여부 */
  guideSeen: Record<string, boolean>;
  /** 최초 메인 페이지 방문 시각 (ISO string) */
  firstVisitAt: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  guideSeen: {},
  firstVisitAt: null,
};

function loadState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: OnboardingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);

  useEffect(() => {
    const loaded = loadState();
    if (!loaded.firstVisitAt) {
      loaded.firstVisitAt = new Date().toISOString();
    }
    setState(loaded);
    saveState(loaded);
  }, []);

  const hasSeenGuide = useCallback(
    (dormitoryId: string): boolean => {
      return state.guideSeen[dormitoryId] === true;
    },
    [state.guideSeen],
  );

  const markGuideSeen = useCallback((dormitoryId: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        guideSeen: { ...prev.guideSeen, [dormitoryId]: true },
      };
      saveState(next);
      return next;
    });
  }, []);

  return { hasSeenGuide, markGuideSeen };
}
