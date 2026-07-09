import { Injectable } from '@nestjs/common';
import type {
  CreateReportResponse,
  ReportListItem,
  ReportListResponse,
  ReportOptionalActionResult,
} from '@repo/shared/social-safety/report';
import { encodeReportListCursor } from '../queries/report-list.cursor.js';
import type { ReportCaseRecord } from '../repositories/report.repository.js';

const reportTargetFallbackLabels: Record<ReportCaseRecord['targetType'], string> = {
  PROFILE: '신고한 사용자',
  MATCH_REQUEST: '매칭 요청 상대',
  CHAT_THREAD: '대화 상대',
  CHAT_MESSAGE: '채팅 메시지 상대',
  SUPPORT_TICKET: '문의 대상',
};

@Injectable()
export class ReportPresenter {
  toCreateResponse(input: {
    report: ReportCaseRecord;
    received: boolean;
    optionalActionResult: ReportOptionalActionResult | null;
  }): CreateReportResponse {
    return {
      report: {
        id: input.report.id,
        targetType: input.report.targetType,
        reason: input.report.reason,
        receivedAt: input.report.receivedAt.toISOString(),
        status: 'RECEIVED',
      },
      received: input.received,
      optionalActionResult: input.optionalActionResult,
    };
  }

  toListResponse(input: {
    records: readonly ReportCaseRecord[];
    limit: number;
  }): ReportListResponse {
    const pageRecords = input.records.slice(0, input.limit);
    const hasNextPage = input.records.length > input.limit;
    const lastRecord = pageRecords.at(-1);

    return {
      items: pageRecords.map(toReportListItem),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && lastRecord
            ? encodeReportListCursor({ id: lastRecord.id, receivedAt: lastRecord.receivedAt })
            : null,
      },
    };
  }
}

function toReportListItem(record: ReportCaseRecord): ReportListItem {
  return {
    id: record.id,
    targetType: record.targetType,
    targetLabel: resolveTargetLabel(record),
    reason: record.reason,
    receivedAt: record.receivedAt.toISOString(),
    status: 'RECEIVED',
  };
}

function resolveTargetLabel(record: ReportCaseRecord): string {
  const displayName = readSnapshotDisplayName(record.targetSnapshot);
  if (displayName) return displayName.endsWith('님') ? displayName : `${displayName}님`;
  return reportTargetFallbackLabels[record.targetType];
}

function readSnapshotDisplayName(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const value = (snapshot as { targetDisplayName?: unknown }).targetDisplayName;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, 78) : null;
}
