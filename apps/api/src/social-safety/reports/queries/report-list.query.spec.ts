import { describe, expect, it, vi } from 'vitest';
import { ReportPresenter } from '../presenters/report.presenter.js';
import type { ReportCaseRecord, ReportRepository } from '../repositories/report.repository.js';
import { ReportListQuery } from './report-list.query.js';

const receivedAt = new Date('2026-07-03T00:00:00.000Z');

function reportRecord(input: Partial<ReportCaseRecord> = {}): ReportCaseRecord {
  const record: ReportCaseRecord = {
    id: 'report-1',
    reporterUserId: 'user-1',
    targetType: 'PROFILE',
    targetId: 'target-user-1',
    targetUserId: 'target-user-1',
    targetParticipantId: 'participant-1',
    targetThreadId: null,
    targetMessageId: null,
    targetMatchRequestId: null,
    seasonId: 'season-1',
    reason: 'FALSE_PROFILE',
    riskTier: 'HIGH',
    status: 'SUBMITTED',
    detail: 'raw report detail must not leak',
    evidenceAttachmentIds: [],
    evidenceAttachmentPolicy: 'TEXT_ONLY',
    optionalBlockRequested: false,
    optionalBlockResult: null,
    falseReportDisclaimerAcceptedAt: receivedAt,
    targetSnapshot: { targetKind: 'PROFILE', targetDisplayName: '지우' },
    receivedAt,
    createdAt: receivedAt,
    updatedAt: receivedAt,
    ...input,
  };
  return record;
}

describe('ReportListQuery', () => {
  it('신고자 본인 접수 내역을 cursor pagination으로 조회하고 민감한 운영 필드를 노출하지 않는다', async () => {
    const findForReporter = vi
      .fn()
      .mockResolvedValue([
        reportRecord({ id: 'report-2', targetSnapshot: { targetKind: 'PROFILE' } }),
        reportRecord({ id: 'report-1' }),
      ]);
    const repository = { findForReporter } as unknown as ReportRepository;
    const query = new ReportListQuery(repository, new ReportPresenter());

    const response = await query.listOwn(
      { id: 'user-1', campus: 'CHUNCHEON', gender: 'M' },
      { cursor: null, limit: 1 },
    );

    expect(findForReporter).toHaveBeenCalledWith({
      reporterUserId: 'user-1',
      cursor: null,
      limit: 1,
    });
    expect(response).toMatchObject({
      items: [
        {
          id: 'report-2',
          targetLabel: '신고한 사용자',
          reason: 'FALSE_PROFILE',
          status: 'RECEIVED',
        },
      ],
    });
    expect(response.pageInfo.hasNextPage).toBe(true);
    expect(typeof response.pageInfo.nextCursor).toBe('string');
    expect(JSON.stringify(response)).not.toContain('riskTier');
    expect(JSON.stringify(response)).not.toContain('raw report detail');
  });
});
