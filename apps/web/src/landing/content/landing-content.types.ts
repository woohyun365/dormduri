export type LandingPolicyCopyId =
  | 'service_independent_notice'
  | 'school_system_not_connected'
  | 'room_selection_not_guaranteed'
  | 'lifestyle_survey_disclaimer'
  | 'profile_privacy_warning'
  | 'season_capability_boundary'
  | 'support_channel_boundary';

export type LandingPolicySurface = 'hero' | 'footer' | 'season' | 'trust' | 'support';

export type LandingSeasonState =
  | 'OFF_SEASON'
  | 'SEASON_OPEN'
  | 'SEASON_MATCHING'
  | 'SEASON_POST_MATCH';

export interface LandingPolicySourceRef {
  path: `docs/04_policy/official/${string}.md`;
  section: string;
  reason: string;
}

export interface LandingPolicyCopy {
  id: LandingPolicyCopyId;
  copy: string;
  source: LandingPolicySourceRef;
  requiredSurface: readonly LandingPolicySurface[];
  testAnchor: string;
}
