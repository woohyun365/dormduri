export type LandingPolicyCopyId =
  | 'service_independent_notice'
  | 'school_system_not_connected'
  | 'room_selection_not_guaranteed'
  | 'lifestyle_survey_disclaimer'
  | 'profile_privacy_warning'
  | 'season_capability_boundary'
  | 'faq_is_not_support_ticket';

export type LandingPolicySurface = 'hero' | 'faq' | 'footer' | 'season' | 'trust' | 'support';

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

export interface LandingFallbackFaqItem {
  id: string;
  question: string;
  answer: string;
  policyCopyIds: readonly LandingPolicyCopyId[];
  source: LandingPolicySourceRef;
  sortOrder: number;
}
