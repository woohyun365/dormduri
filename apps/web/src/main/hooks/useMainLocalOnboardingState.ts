import { useCallback, useState } from 'react';

function storageKey(userId: string): string {
  return `main-local-onboarding:${userId}`;
}

interface MainLocalOnboardingState {
  guideSeen: Record<string, boolean>;
  tooltipSeen: Record<string, boolean>;
}

function createDefaultState(): MainLocalOnboardingState {
  return { guideSeen: {}, tooltipSeen: {} };
}

function loadState(userId: string): MainLocalOnboardingState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return createDefaultState();
    return { ...createDefaultState(), ...JSON.parse(raw) };
  } catch {
    return createDefaultState();
  }
}

function saveState(userId: string, state: MainLocalOnboardingState) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function useMainLocalOnboardingState(userId?: string) {
  const key = userId ?? '_anonymous';
  const [state, setState] = useState<MainLocalOnboardingState>(() => loadState(key));

  const update = useCallback(
    (updater: (prev: MainLocalOnboardingState) => MainLocalOnboardingState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(key, next);
        return next;
      });
    },
    [key],
  );

  const hasSeenGuide = useCallback(
    (dormitoryId: string): boolean => state.guideSeen[dormitoryId] === true,
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

  const hasSeenTooltip = useCallback(
    (tooltipId: string): boolean => state.tooltipSeen[tooltipId] === true,
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
    hasSeenTooltip,
    markTooltipSeen,
  };
}
