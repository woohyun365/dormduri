import { describe, expect, it } from 'vitest';
import {
  canonicalizeDisplayIdentityNickname,
  parseDisplayIdentityNickname,
} from '@repo/shared/user/identity/display';
import { signupDraftValidationRequestSchema } from '@repo/shared/auth/contract';

describe('shared display identity nickname policy', () => {
  it.each([
    ['너무더운날씨', 'HANGUL', '너무더운날씨'],
    ['niceguy', 'LATIN', 'niceguy'],
    ['하늘2', 'HANGUL', '하늘2'],
    ['room2026', 'LATIN', 'room2026'],
    ['  ＮiceＧuy  ', 'LATIN', 'niceguy'],
  ] as const)(
    '%s를 canonical single-script nickname으로 parse한다',
    (input, script, normalized) => {
      expect(parseDisplayIdentityNickname(input)).toMatchObject({
        ok: true,
        script,
        normalized,
      });
    },
  );

  it.each([
    ['안녕hi', 'MIXED_SCRIPT'],
    ['헬로world', 'MIXED_SCRIPT'],
    ['섹s스ex', 'MIXED_SCRIPT'],
    ['1234', 'DIGITS_ONLY'],
    ['ㅎㅇ', 'INVALID_CHARACTERS'],
    ['nice_guy', 'INVALID_CHARACTERS'],
    ['한 글', 'INVALID_CHARACTERS'],
    ['가', 'TOO_SHORT'],
    ['가나다라마바사아자', 'TOO_LONG'],
    ['', 'REQUIRED'],
  ] as const)('%s를 %s 구조 오류로 거절한다', (input, code) => {
    expect(parseDisplayIdentityNickname(input)).toMatchObject({ ok: false, code });
  });

  it('canonical display value와 normalized key에 같은 NFKC 기준을 적용한다', () => {
    expect(canonicalizeDisplayIdentityNickname('  Ｒoom２  ')).toBe('Room2');
    expect(parseDisplayIdentityNickname('  Ｒoom２  ')).toEqual({
      ok: true,
      value: 'Room2',
      normalized: 'room2',
      script: 'LATIN',
    });
  });

  it('auth request contract도 shared canonical display value를 전달한다', () => {
    expect(
      signupDraftValidationRequestSchema.parse({
        email: 'student@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '  ＮiceＧuy  ',
      }).nickname,
    ).toBe('NiceGuy');
  });
});
