import { describe, expect, it } from 'vitest';
import { matchesModerationTerm, normalizeForModeration } from './text-moderation.policy.js';

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

  it.each(['시1발', '시1111발', '시-1111-발'])(
    '한글 사이 숫자 삽입 우회 %s를 감지한다',
    (value) => {
      expect(
        matchesModerationTerm(normalizeForModeration(value), {
          term: '시발',
          normalizedTerm: normalizeForModeration('시발'),
          matchMode: 'INCLUDES',
        }),
      ).toBe(true);
    },
  );

  it('한글 뒤의 일반 숫자 suffix는 제거하지 않는다', () => {
    expect(
      matchesModerationTerm(normalizeForModeration('하늘2026'), {
        term: '하늘',
        normalizedTerm: normalizeForModeration('하늘'),
        matchMode: 'EXACT',
      }),
    ).toBe(false);
  });

  it('PREFIX 매치는 접두 회피를 차단하고 정상 단어 내부의 짧은 문자열은 허용한다', () => {
    const term = {
      term: 'sex',
      normalizedTerm: normalizeForModeration('sex'),
      matchMode: 'PREFIX' as const,
    };

    expect(matchesModerationTerm(normalizeForModeration('sex123'), term)).toBe(true);
    expect(matchesModerationTerm(normalizeForModeration('sussex'), term)).toBe(false);
  });
});
