import { describe, expect, it } from 'vitest';
import { mapRoommateSearchAvailabilityNotices } from '../roommateSearchNotices';

const KNOWN_CODES = [
  'MATCHED_TARGETS_EXCLUDED',
  'DISCOVERY_ACTIONABLE_ONLY',
  'SCOPE_RESTRICTED_BY_VIEWER_STATE',
  'POST_MATCH_ACTION_CLOSED',
  'DETAIL_UNAVAILABLE_BY_POLICY',
  'FILTER_RESULT_EMPTY',
] as const;

describe('roommateSearchNotices', () => {
  it('모든 shared availability notice code를 safe Korean copy로 매핑한다', () => {
    const notices = mapRoommateSearchAvailabilityNotices(
      KNOWN_CODES.map((code) => ({ code, severity: 'INFO' as const, message: 'raw upstream' })),
    );

    expect(notices).toHaveLength(KNOWN_CODES.length);
    for (const notice of notices) {
      expect(notice.title).not.toBe('raw upstream');
      expect(notice.message).not.toBe('raw upstream');
      expect(notice.liveRegion).toBe('polite');
    }
    expect(notices.find((notice) => notice.code === 'FILTER_RESULT_EMPTY')?.emptyState).toBe(true);
  });

  it('unknown/future code는 generic info copy로 degrade한다', () => {
    const [notice] = mapRoommateSearchAvailabilityNotices([
      { code: 'FUTURE_NOTICE_CODE', severity: 'WARNING', message: 'raw future message' },
    ]);

    if (!notice) throw new Error('notice should be mapped');
    expect(notice).toMatchObject({
      code: 'UNKNOWN_ROOMMATE_SEARCH_NOTICE',
      severity: 'WARNING',
      emptyState: false,
    });
    expect(notice.message).not.toBe('raw future message');
  });
});
