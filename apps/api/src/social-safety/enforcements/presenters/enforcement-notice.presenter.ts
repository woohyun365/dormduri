import { Injectable } from '@nestjs/common';
import type {
  EnforcementActionType,
  EnforcementNotice,
  EnforcementNoticeListResponse,
  EnforcementNoticeStatus,
  EnforcementReasonCategory,
} from '@repo/shared/social-safety/enforcement';
import { encodeEnforcementNoticeListCursor } from '../queries/enforcement-notice-list.cursor.js';
import {
  toEnforcementNoticeId,
  type EnforcementNoticeProjectionRecord,
} from '../repositories/enforcement-notice.repository.js';

@Injectable()
export class EnforcementNoticePresenter {
  toListResponse(input: {
    records: readonly EnforcementNoticeProjectionRecord[];
    limit: number;
    now: Date;
  }): EnforcementNoticeListResponse {
    const pageRecords = input.records.slice(0, input.limit);
    const hasNextPage = input.records.length > input.limit;
    const lastRecord = pageRecords.at(-1);

    return {
      items: pageRecords.map((record) => toNotice(record, input.now)),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && lastRecord
            ? encodeEnforcementNoticeListCursor({
                id: lastRecord.id,
                updatedAt: lastRecord.updatedAt,
              })
            : null,
      },
    };
  }
}

function toNotice(record: EnforcementNoticeProjectionRecord, now: Date): EnforcementNotice {
  const effectiveFrom = record.deactivatedAt ?? record.hiddenByAdminAt ?? record.updatedAt;
  const effectiveUntil = record.season.seasonEndDate;
  const status = resolveStatus(effectiveUntil, now);
  const reasonCategory = resolveReasonCategory(record.hiddenReasonCode);
  const seasonLabel = resolveSeasonLabel(record);

  return {
    id: toEnforcementNoticeId(record.id),
    actionType: resolveActionType(record),
    reasonCategory,
    status,
    seasonLabel,
    scopeLabel: resolveScopeLabel(record, seasonLabel),
    policyBasisSummary: resolvePolicyBasisSummary(reasonCategory),
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveUntil: effectiveUntil.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

function resolveActionType(record: EnforcementNoticeProjectionRecord): EnforcementActionType {
  if (record.deactivatedAt) return 'MATCHING_RESTRICTION';
  return 'CONTENT_VISIBILITY_RESTRICTION';
}

function resolveReasonCategory(
  hiddenReasonCode: EnforcementNoticeProjectionRecord['hiddenReasonCode'],
): EnforcementReasonCategory {
  switch (hiddenReasonCode) {
    case 'POLICY_VIOLATION':
      return 'POLICY_VIOLATION';
    case 'SAFETY_REVIEW':
      return 'SAFETY_REVIEW';
    case 'ADMIN_REQUEST':
      return 'ADMIN_ACTION';
    case 'OTHER':
    default:
      return 'OTHER';
  }
}

function resolveStatus(effectiveUntil: Date, now: Date): EnforcementNoticeStatus {
  return effectiveUntil.getTime() < now.getTime() ? 'ENDED' : 'ACTIVE';
}

function resolveSeasonLabel(record: EnforcementNoticeProjectionRecord): string {
  const rawName = record.season.name.trim();
  if (rawName.length > 0) return rawName.slice(0, 80);
  return `${record.season.academicYear}년 ${record.season.semester}학기`;
}

function resolveScopeLabel(record: EnforcementNoticeProjectionRecord, seasonLabel: string): string {
  const dormitoryName = record.dormitory?.nameKo?.trim();
  const base = dormitoryName ? `${seasonLabel} · ${dormitoryName}` : seasonLabel;
  return `${base} 룸메 탐색/매칭`;
}

function resolvePolicyBasisSummary(reasonCategory: EnforcementReasonCategory): string {
  switch (reasonCategory) {
    case 'POLICY_VIOLATION':
      return '신고 또는 운영 검토에서 서비스 이용 기준 위반이 확인된 경우 적용돼요.';
    case 'SAFETY_REVIEW':
      return '운영 검토 중 필요한 범위에서 룸메 탐색과 상호작용을 제한할 수 있어요.';
    case 'ADMIN_ACTION':
      return '운영팀이 최신 상태를 확인한 뒤 필요한 범위에서 적용한 제한이에요.';
    default:
      return '서비스 이용 기준에 따라 필요한 범위에서 적용된 제한이에요.';
  }
}
