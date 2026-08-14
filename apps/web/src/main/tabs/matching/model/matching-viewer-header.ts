/**
 * Narrow display-only identity supplied by Main's authenticated dashboard.
 * It is not used for matching policy or action authorization.
 */
export interface MatchingViewerHeader {
  readonly nickname: string;
  readonly gender: 'M' | 'F';
  readonly campusLabel: string;
  readonly residenceLabel: string | null;
}
