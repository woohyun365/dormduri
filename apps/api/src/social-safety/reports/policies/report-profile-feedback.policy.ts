import type { ReportReason, ReportTargetType } from '@repo/shared/social-safety/report';

export function shouldRecordProfileMismatchFeedbackCandidate(input: {
  reason: ReportReason;
  targetType: ReportTargetType;
}): boolean {
  return input.reason === 'FALSE_PROFILE' && input.targetType === 'PROFILE';
}
