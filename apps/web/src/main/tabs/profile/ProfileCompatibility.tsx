'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { HomeDashboardResponse } from '@repo/shared/home';
import { useMainProfileState } from '@/main/hooks/useMainProfileState';
import { useMainSocialState } from '@/main/hooks/useMainSocialState';
import { toMainLegacyUserProfile } from '@/main/utils/mainDashboardAdapters';
import type { MainViewerDisplay } from '@/main/runtime/MainContexts';

const showToast = (message: string) => toast(message);
const ProfileContext = createContext<{
  profile: ReturnType<typeof useMainProfileState>;
  social: ReturnType<typeof useMainSocialState>;
} | null>(null);
const DormitoryOverlayContext = createContext<Pick<
  MainViewerDisplay,
  'dormitoryId' | 'dormitory'
> | null>(null);

// Temporary, server-unsaved Profile-owned state. Only the narrow readonly dormitory overlay
// is available to sibling features. A scope change resets state, not the child route tree.
export function ProfileCompatibility({
  dashboard,
  scopeKey,
  children,
}: {
  dashboard: HomeDashboardResponse;
  scopeKey: string;
  children: ReactNode;
}) {
  const initialUser = useMemo(() => toMainLegacyUserProfile(dashboard), [dashboard]);
  const dormitories = useMemo(
    () =>
      dashboard.season.operatedDormitories.flatMap((operation) =>
        operation.dormitory ? [operation.dormitory] : [],
      ),
    [dashboard.season.operatedDormitories],
  );
  const profile = useMainProfileState(initialUser, { showToast, dormitories, scopeKey });
  const social = useMainSocialState(showToast, scopeKey);
  const overlay = profile.dormitoryEdited
    ? { dormitoryId: profile.user.dormitoryId, dormitory: profile.user.dormitory }
    : null;
  return (
    <ProfileContext.Provider value={{ profile, social }}>
      <DormitoryOverlayContext.Provider value={overlay}>
        {children}
      </DormitoryOverlayContext.Provider>
    </ProfileContext.Provider>
  );
}

export function useProfileCompatibility() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('Profile must be inside ProfileCompatibility');
  return value;
}

export function useDormitoryCompatibility(viewer: MainViewerDisplay): MainViewerDisplay {
  const overlay = useContext(DormitoryOverlayContext);
  return overlay === null ? viewer : { ...viewer, ...overlay };
}
