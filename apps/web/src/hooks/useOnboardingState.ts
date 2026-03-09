import { useState, useCallback } from 'react';

/**
 * 온보딩 상태 관리 훅
 *
 * 현재는 localStorage에 사용자별로 저장한다.
 * 추후 서버 연동 시 이 훅 내부만 수정하면 된다.
 * (localStorage → GET/PATCH /api/user/onboarding)
 */

function storageKey(userId: string): string {
  return `onboarding:${userId}`;
}

interface OnboardingState {
  /** 건물별 가이드 표시 여부 */
  guideSeen: Record<string, boolean>;
  /** 최초 메인 페이지 방문 시각 (ISO string) */
  firstVisitAt: string | null;
  /** 체크리스트 수동 닫기 여부 */
  checklistDismissed: boolean;
  /** 완료 후 강제 재표시 여부 */
  forceShowChecklist: boolean;
  /** 툴팁별 표시 여부 */
  tooltipSeen: Record<string, boolean>;
}

const DEFAULT_STATE: OnboardingState = {
  guideSeen: {},
  firstVisitAt: null,
  checklistDismissed: false,
  forceShowChecklist: false,
  tooltipSeen: {},
};

function createDefaultState(): OnboardingState {
  return { ...DEFAULT_STATE, guideSeen: {}, tooltipSeen: {} };
}

function loadState(userId: string): OnboardingState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return createDefaultState();
    return { ...createDefaultState(), ...JSON.parse(raw) };
  } catch {
    return createDefaultState();
  }
}

function saveState(userId: string, state: OnboardingState) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function useOnboardingState(userId?: string) {
  const key = userId ?? '_anonymous';

  const [state, setState] = useState<OnboardingState>(() => {
    const loaded = loadState(key);
    if (!loaded.firstVisitAt && typeof window !== 'undefined') {
      loaded.firstVisitAt = new Date().toISOString();
      saveState(key, loaded);
    }
    return loaded;
  });

  const update = useCallback(
    (updater: (prev: OnboardingState) => OnboardingState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(key, next);
        return next;
      });
    },
    [key],
  );

  // --- 건물 가이드 ---
  const hasSeenGuide = useCallback(
    (dormitoryId: string): boolean => {
      return state.guideSeen[dormitoryId] === true;
    },
    [state.guideSeen],
  );

  const markGuideSeen = useCallback(
    (dormitoryId: string) => {
      update((prev) => ({
        ...prev,
        guideSeen: { ...prev.guideSeen, [dormitoryId]: true },
      }));
    },
    [update],
  );

  // --- 체크리스트 ---
  const isChecklistDismissed = state.checklistDismissed;
  const forceShowChecklist = state.forceShowChecklist;

  const dismissChecklist = useCallback(() => {
    update((prev) => ({ ...prev, checklistDismissed: true, forceShowChecklist: false }));
  }, [update]);

  const resetChecklist = useCallback(() => {
    update((prev) => ({ ...prev, checklistDismissed: false, forceShowChecklist: true }));
  }, [update]);

  // --- 툴팁 ---
  const hasSeenTooltip = useCallback(
    (tooltipId: string): boolean => {
      return state.tooltipSeen[tooltipId] === true;
    },
    [state.tooltipSeen],
  );

  const markTooltipSeen = useCallback(
    (tooltipId: string) => {
      update((prev) => ({
        ...prev,
        tooltipSeen: { ...prev.tooltipSeen, [tooltipId]: true },
      }));
    },
    [update],
  );

  return {
    hasSeenGuide,
    markGuideSeen,
    isChecklistDismissed,
    forceShowChecklist,
    dismissChecklist,
    resetChecklist,
    hasSeenTooltip,
    markTooltipSeen,
  };
}
