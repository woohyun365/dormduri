import { toOperatorAlertRecordPayload } from './operator-alert-payload.policy.js';

describe('operator alert payload policy', () => {
  it('operator alert sink payload는 운영 allowlist pointer만 허용한다', () => {
    expect(
      toOperatorAlertRecordPayload({
        sourceType: 'REPORT_CASE',
        sourceId: 'report-1',
        category: 'HIGH_RISK_REPORT',
        riskTier: 'HIGH',
        severity: 'CRITICAL',
        occurredAt: '2026-06-08T00:00:00.000Z',
      }),
    ).toEqual({
      sourceType: 'REPORT_CASE',
      sourceId: 'report-1',
      category: 'HIGH_RISK_REPORT',
      riskTier: 'HIGH',
      severity: 'CRITICAL',
      occurredAt: '2026-06-08T00:00:00.000Z',
    });
  });

  it('report detail/body/email/RRPD와 임의 key를 거절한다', () => {
    expect(() =>
      toOperatorAlertRecordPayload({
        sourceType: 'REPORT_CASE',
        sourceId: 'report-1',
        category: 'HIGH_RISK_REPORT',
        riskTier: 'HIGH',
        severity: 'CRITICAL',
        occurredAt: '2026-06-08T00:00:00.000Z',
        reportDetail: 'raw 신고 본문',
      } as never),
    ).toThrow('reportDetail');

    expect(() =>
      toOperatorAlertRecordPayload({
        sourceType: 'REPORT_CASE',
        sourceId: 'report-1',
        category: 'HIGH_RISK_REPORT',
        riskTier: 'HIGH',
        severity: 'CRITICAL',
        occurredAt: '2026-06-08T00:00:00.000Z',
        reviewerMemo: 'internal note',
      } as never),
    ).toThrow('reviewerMemo');
  });
});
