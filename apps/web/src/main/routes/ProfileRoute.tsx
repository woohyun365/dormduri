'use client';

import ProfileTab from '@/main/tabs/profile/ProfileTab';
import { useProfileCompatibility } from '@/main/tabs/profile/ProfileCompatibility';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import { useMainShell } from '@/main/runtime/MainContexts';

export default function ProfileRoute() {
  const { profile, social } = useProfileCompatibility();
  const shell = useMainShell();
  return (
    <SeasonProvider value={{ ...shell.season, state: shell.season.state ?? 'OFF_SEASON' }}>
      <ProfileTab
        key={shell.scopeKey}
        user={profile.user}
        onDormitoryChange={profile.handleSelectDormitory}
        onIntroChange={profile.handleIntroChange}
        onLifestyleChange={profile.handleLifestyleChange}
        onAdditionalChange={profile.handleAdditionalChange}
        blockedUsers={social.blockedUsers}
        onUnblock={social.handleUnblockUser}
      />
    </SeasonProvider>
  );
}
