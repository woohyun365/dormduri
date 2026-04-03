import { matchesModerationTerm, normalizeForModeration } from './text-moderation.js';

describe('text moderation helpers', () => {
  it('NFKC 정규화 + 공백/기호 제거 기준으로 비교한다', () => {
    expect(normalizeForModeration('  ㅅ!ㅂ  ')).toBe(normalizeForModeration('ㅅㅂ'));
  });

  it('EXACT 매치는 정규화된 완전일치만 허용한다', () => {
    expect(
      matchesModerationTerm(normalizeForModeration('admin'), {
        term: 'admin',
        normalizedTerm: normalizeForModeration('admin'),
        matchMode: 'EXACT',
      }),
    ).toBe(true);
    expect(
      matchesModerationTerm(normalizeForModeration('greatest'), {
        term: 'test',
        normalizedTerm: normalizeForModeration('test'),
        matchMode: 'EXACT',
      }),
    ).toBe(false);
  });

  it('INCLUDES 매치는 우회된 금지어 포함을 감지한다', () => {
    expect(
      matchesModerationTerm(normalizeForModeration('안녕하세요 ㅅ!ㅂ 테스트'), {
        term: 'ㅅㅂ',
        normalizedTerm: normalizeForModeration('ㅅㅂ'),
        matchMode: 'INCLUDES',
      }),
    ).toBe(true);
  });
});
