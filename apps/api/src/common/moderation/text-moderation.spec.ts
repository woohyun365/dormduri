import {
  containsBlockedTerm,
  moderatePublicText,
  normalizeForModeration,
} from './text-moderation.js';

describe('text moderation', () => {
  it('NFKC 정규화 + 공백/기호 제거 기준으로 비교한다', () => {
    expect(normalizeForModeration('  ㅅ!ㅂ  ')).toBe(normalizeForModeration('ㅅㅂ'));
  });

  it('정책상 금지어는 차단한다', () => {
    expect(containsBlockedTerm('씨발')).toBe(true);
    expect(moderatePublicText('안녕하세요 ㅅ!ㅂ 테스트', 'intro')).toEqual({
      ok: false,
      error: '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.',
    });
  });

  it('정책상 허용되는 민감 용어는 차단하지 않는다', () => {
    expect(containsBlockedTerm('게이 룸메 구합니다')).toBe(false);
    expect(moderatePublicText('장애인 관련 동아리 활동을 했어요', 'intro')).toEqual({
      ok: true,
    });
  });
});
