import type {
  OperatorAlertCategory,
  OperatorAlertSeverity,
  ReportRiskTier,
} from '../../generated/prisma/enums.js';

export const OPERATOR_ALERT_SINK = Symbol('OPERATOR_ALERT_SINK');

export const OPERATOR_ALERT_EXTERNAL_SINK_ENV_KEYS = [
  'OPERATOR_ALERT_DISCORD_WEBHOOK_URL',
  'OPERATOR_ALERT_SLACK_WEBHOOK_URL',
] as const;

export const OPERATOR_ALERT_OBSERVABILITY_NAMES = [
  'operator_alert_pending',
  'operator_alert_failed',
  'operator_alert_dispatched',
  'notification_campaign_lag',
  'notification_outbox_pending',
  'notification_write_duplicate_count',
] as const;

export interface OperatorAlertSinkPayload {
  alertId: string;
  sourceType: 'REPORT_CASE';
  sourceId: string;
  category: OperatorAlertCategory;
  riskTier: ReportRiskTier | null;
  severity: OperatorAlertSeverity;
  occurredAt: string;
}

export interface OperatorAlertSinkResult {
  delivered: boolean;
  skippedReason?: 'EXTERNAL_SINK_DISABLED';
  errorMessage?: string;
}

export interface OperatorAlertSinkPort {
  dispatch(payload: OperatorAlertSinkPayload): Promise<OperatorAlertSinkResult>;
}
