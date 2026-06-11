export const MATCH_LIFECYCLE_SWEEP_PORT = Symbol('MATCH_LIFECYCLE_SWEEP_PORT');

export interface MatchLifecycleSweepResult {
  expiredRequests: number;
  expiredUnmatchRequests: number;
  seasonEndedActiveMatches: number;
}

export interface MatchLifecycleSweepPort {
  sweepMatchLifecycleTransitions(now: Date): Promise<MatchLifecycleSweepResult>;
}
