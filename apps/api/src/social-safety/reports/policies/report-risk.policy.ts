import type { ReportReason, ReportRiskTier } from '@repo/shared/social-safety/report';

const HIGH_RISK_REASONS = new Set<ReportReason>([
  'SEXUAL_HARASSMENT',
  'THREAT',
  'PERSONAL_INFO_EXPOSURE',
]);

const MEDIUM_RISK_REASONS = new Set<ReportReason>([
  'GENDER_IMPERSONATION',
  'FALSE_PROFILE',
  'HATE_OR_DISCRIMINATION',
]);

export function resolveReportRiskTier(reason: ReportReason): ReportRiskTier {
  if (HIGH_RISK_REASONS.has(reason)) {
    return 'HIGH';
  }
  if (MEDIUM_RISK_REASONS.has(reason)) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function shouldRecordHighRiskAlertCandidate(reason: ReportReason): boolean {
  return resolveReportRiskTier(reason) === 'HIGH';
}
