'use client';

import RoommateListTab from '@/main/tabs/roommate-list/RoommateListTab';
import { useDormitoryCompatibility } from '@/main/tabs/profile/ProfileCompatibility';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import { useMainShell } from '@/main/runtime/MainContexts';

export default function RoommatesRoute() {
  const shell = useMainShell();
  const viewer = useDormitoryCompatibility(shell.viewer);
  return (
    <SeasonProvider value={{ ...shell.season, state: shell.season.state ?? 'OFF_SEASON' }}>
      <RoommateListTab
        key={shell.scopeKey}
        user={viewer}
        onNavigate={shell.navigate}
        searchEntryAllowed={shell.canEnterRoommateSearch}
        viewerSeasonRegistered={shell.registered}
      />
    </SeasonProvider>
  );
}
