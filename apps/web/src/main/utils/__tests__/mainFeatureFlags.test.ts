import { describe, expect, it } from 'vitest';
import { getMainFeatureFlags } from '../mainFeatureFlags';

describe('getMainFeatureFlags', () => {
  it('운영 캠퍼스 + 시즌 매칭이면 요청/북마크/매칭 탭을 모두 허용한다', () => {
    expect(getMainFeatureFlags({ campusOperated: true, isOpen: false, isMatching: true })).toEqual({
      canOpenMatchingTab: true,
      canSendMatchRequest: true,
      canToggleBookmark: true,
      disabledTabs: [],
    });
  });

  it('운영 캠퍼스 + 시즌 오픈이면 북마크만 허용하고 요청은 차단한다', () => {
    expect(getMainFeatureFlags({ campusOperated: true, isOpen: true, isMatching: false })).toEqual({
      canOpenMatchingTab: true,
      canSendMatchRequest: false,
      canToggleBookmark: true,
      disabledTabs: [],
    });
  });

  it('비운영 캠퍼스면 요청/북마크/매칭 탭을 모두 차단한다', () => {
    expect(getMainFeatureFlags({ campusOperated: false, isOpen: true, isMatching: true })).toEqual({
      canOpenMatchingTab: false,
      canSendMatchRequest: false,
      canToggleBookmark: false,
      disabledTabs: ['matching'],
    });
  });
});
