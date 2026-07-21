import type { TabId } from '@/main/model/navigation';

interface MainFeatureFlagParams {
  campusOperated: boolean;
  isOpen: boolean;
  isMatching: boolean;
}

export interface MainFeatureFlags {
  canOpenMatchingTab: boolean;
  canSendMatchRequest: boolean;
  canToggleBookmark: boolean;
  disabledTabs: TabId[];
}

export function getMainFeatureFlags({
  campusOperated,
  isOpen,
  isMatching,
}: MainFeatureFlagParams): MainFeatureFlags {
  return {
    canOpenMatchingTab: campusOperated,
    canSendMatchRequest: campusOperated && isMatching,
    canToggleBookmark: campusOperated && (isOpen || isMatching),
    disabledTabs: campusOperated ? [] : ['matching'],
  };
}
