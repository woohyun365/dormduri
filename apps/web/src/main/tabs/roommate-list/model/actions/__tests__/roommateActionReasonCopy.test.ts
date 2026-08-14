import { describe, expect, it } from 'vitest';
import {
  formatRoommateActionError,
  formatTargetActionUnavailableReason,
  getReportReasonOptions,
  reportOptionalActionResultCopy,
  reportReasonLabel,
} from '../roommateActionReasonCopy';
import type { PublicTargetActionUnavailableReason } from '@repo/shared/profile/contract';
import type { ReportReason } from '@repo/shared/social-safety/report';

const unavailableReasons: readonly PublicTargetActionUnavailableReason[] = [
  'VIEWER_NOT_REGISTERED',
  'VIEWER_PROFILE_INCOMPLETE',
  'VIEWER_NOT_ASSIGNED',
  'TARGET_NOT_PUBLIC',
  'DIFFERENT_DORMITORY',
  'VIEWER_ALREADY_MATCHED',
  'TARGET_ALREADY_MATCHED',
  'SEASON_NOT_ACTIONABLE',
  'ROOM_SELECTION_CUTOFF',
  'THREAD_READ_ONLY',
  'TARGET_DELETED_OR_DEIDENTIFIED',
  'SAFETY_OR_VISIBILITY_RESTRICTED',
  'MATCH_REQUEST_ALREADY_PENDING',
  'MATCH_REQUEST_PENDING_LIMIT_REACHED',
  'MATCH_REQUEST_DIRECTION_LIMIT_REACHED',
  'MATCH_REQUEST_DIRECTION_COOLDOWN_ACTIVE',
];

const reportReasons: readonly ReportReason[] = [
  'SEXUAL_HARASSMENT',
  'THREAT',
  'PERSONAL_INFO_EXPOSURE',
  'GENDER_IMPERSONATION',
  'FALSE_PROFILE',
  'SPAM_OR_AD',
  'HATE_OR_DISCRIMINATION',
  'OTHER',
];

describe('roommateActionReasonCopy', () => {
  it('모든 public action unavailable reason을 safe copy로 변환한다', () => {
    for (const reason of unavailableReasons) {
      expect(formatTargetActionUnavailableReason(reason)).toEqual(expect.any(String));
      expect(formatTargetActionUnavailableReason(reason)).not.toContain(reason);
    }
  });

  it('모든 report reason을 label option으로 제공한다', () => {
    const options = getReportReasonOptions();
    expect(options.map((option) => option.value)).toEqual(reportReasons);
    for (const reason of reportReasons) {
      expect(reportReasonLabel(reason)).toEqual(expect.any(String));
    }
  });

  it('match request stale/domain code를 raw code 없이 expected race copy로 변환한다', () => {
    const copy = formatRoommateActionError({ code: 'MATCH_REQUEST_NOT_ALLOWED' }, 'matchRequest');

    expect(copy.title).toBe('매칭 요청을 보낼 수 없어요.');
    expect(copy.message).toContain('목록을 새로고침');
    expect(copy.message).not.toContain('MATCH_REQUEST_NOT_ALLOWED');
  });

  it('active match race를 상대 매칭 완료 안내로 변환한다', () => {
    const copy = formatRoommateActionError({ code: 'ACTIVE_MATCH_ALREADY_EXISTS' }, 'matchRequest');

    expect(copy.title).toBe('매칭 요청을 보낼 수 없어요.');
    expect(copy.message).toBe(
      '상대가 매칭이 완료되어 매칭 요청을 보낼 수 없어요. 목록을 새로고침 후 다른 후보를 찾아보세요.',
    );
  });

  it('match request temporary failure를 재시도 가능한 사용자 문구로 변환한다', () => {
    const copy = formatRoommateActionError({ code: 'BFF_UPSTREAM_UNAVAILABLE' }, 'matchRequest');

    expect(copy.title).toBe('매칭 요청을 보내지 못했어요.');
    expect(copy.message).toContain('잠시 후 다시 시도');
    expect(copy.message).not.toContain('BFF_UPSTREAM_UNAVAILABLE');
  });

  it('report temporary failure를 연결 재시도 안내로 변환한다', () => {
    const upstreamCopy = formatRoommateActionError({ code: 'BFF_UPSTREAM_UNAVAILABLE' }, 'report');
    const networkCopy = formatRoommateActionError(
      { code: 'ROOMMATE_ACTION_NETWORK_ERROR' },
      'report',
    );

    expect(upstreamCopy.title).toBe('신고를 접수하지 못했어요.');
    expect(upstreamCopy.message).toBe('잠시 후 다시 시도해 주세요.');
    expect(upstreamCopy.message).not.toContain('BFF_UPSTREAM_UNAVAILABLE');
    expect(networkCopy.title).toBe('신고를 접수하지 못했어요.');
    expect(networkCopy.message).toBe('잠시 후 다시 시도해 주세요.');
    expect(networkCopy.message).not.toContain('ROOMMATE_ACTION_NETWORK_ERROR');
  });

  it('match request target deregistered race를 시즌 등록 철회 안내로 변환한다', () => {
    const copy = formatRoommateActionError(
      { code: 'MATCH_REQUEST_TARGET_NOT_FOUND' },
      'matchRequest',
    );

    expect(copy.title).toBe('매칭 요청을 보낼 수 없어요.');
    expect(copy.message).toBe('상대가 시즌 등록을 철회하여 매칭 요청을 보낼 수 없어요.');
    expect(copy.message).not.toContain('MATCH_REQUEST_TARGET_NOT_FOUND');
  });

  it('match request pending/limit domain error도 modal 실패 제목으로 변환한다', () => {
    const alreadyPending = formatRoommateActionError(
      { code: 'MATCH_REQUEST_ALREADY_PENDING' },
      'matchRequest',
    );
    const limitReached = formatRoommateActionError(
      { code: 'MATCH_REQUEST_DIRECTION_LIMIT_REACHED' },
      'matchRequest',
    );

    expect(alreadyPending.title).toBe('매칭 요청을 보내지 못했어요.');
    expect(alreadyPending.message).toBe(
      '이미 매칭 요청을 보낸 상대에요. 매칭 탭에서 확인해주세요.',
    );
    expect(limitReached.title).toBe('매칭 요청을 보내지 못했어요.');
    expect(limitReached.message).toBe(
      '이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요',
    );
  });

  it('report optional block result를 raw code 없이 safe status copy로 변환한다', () => {
    expect(
      reportOptionalActionResultCopy({ action: 'BLOCK_TARGET', status: 'FAILED', code: 'RAW' }),
    ).toContain('신고는 접수');
    expect(
      reportOptionalActionResultCopy({ action: 'BLOCK_TARGET', status: 'FAILED', code: 'RAW' }),
    ).not.toContain('RAW');
  });
});
