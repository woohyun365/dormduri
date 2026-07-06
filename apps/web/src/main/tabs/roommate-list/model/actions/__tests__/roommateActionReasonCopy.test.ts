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

  it('report optional block result를 raw code 없이 safe status copy로 변환한다', () => {
    expect(
      reportOptionalActionResultCopy({ action: 'BLOCK_TARGET', status: 'FAILED', code: 'RAW' }),
    ).toContain('신고는 접수');
    expect(
      reportOptionalActionResultCopy({ action: 'BLOCK_TARGET', status: 'FAILED', code: 'RAW' }),
    ).not.toContain('RAW');
  });
});
