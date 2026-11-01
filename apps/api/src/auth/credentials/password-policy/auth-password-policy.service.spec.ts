import { describe, expect, it } from 'vitest';
import { AuthPasswordPolicyService } from './auth-password-policy.service.js';

describe('AuthPasswordPolicyService', () => {
  const policy = new AuthPasswordPolicyService();

  it.each([
    'Password1!',
    'PASSWORD1!',
    'abcdefghij',
    '1234567890',
    'knuroommate2026',
    'dormduri2026',
  ])('대표 common/service value %s를 exact lookup으로 거절한다', (password) => {
    expect(
      policy.evaluateNewPassword(password, {
        email: 'student@kangwon.ac.kr',
        nickname: '감자친구',
      }),
    ).toMatchObject({ ok: false, code: 'COMMON_VALUE', reason: 'common' });
  });

  it.each([
    ['longstudent@kangwon.ac.kr', 'longstudent@kangwon.ac.kr', '감자친구'],
    ['longstudent', 'longstudent@kangwon.ac.kr', '감자친구'],
    ['knuStudent', 'knuStudent@kangwon.ac.kr', '감자친구'],
    ['LongNickname', 'student@kangwon.ac.kr', 'longnickname'],
  ])(
    'email/local-part/nickname와 같은 값 %s를 contextual value로 거절한다',
    (password, email, nickname) => {
      expect(policy.evaluateNewPassword(password, { email, nickname })).toMatchObject({
        ok: false,
        reason: 'contextual',
      });
    },
  );

  it('public text moderation처럼 substring을 검사하지 않는다', () => {
    expect(
      policy.evaluateNewPassword('sex-roommate-2026!', {
        email: 'student@kangwon.ac.kr',
        nickname: '테스터',
      }),
    ).toEqual({ ok: true });
    expect(
      policy.evaluateNewPassword('Password1!-unique', {
        email: 'student@kangwon.ac.kr',
        nickname: '테스터',
      }),
    ).toEqual({ ok: true });
  });

  it('policy decision에는 입력 원문이나 matched reference를 포함하지 않는다', () => {
    const password = 'Password1!';
    const decision = policy.evaluateNewPassword(password, {
      email: 'student@kangwon.ac.kr',
      nickname: '테스터',
    });
    const serialized = JSON.stringify(decision);

    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(password.toLowerCase());
  });

  it.each([
    ['', 'REQUIRED', 'required'],
    ['short', 'TOO_SHORT', 'too_short'],
    ['a'.repeat(129), 'TOO_LONG', 'too_long'],
    ['valid pass1', 'WHITESPACE_NOT_ALLOWED', 'whitespace'],
    ['유효하지않은비밀번호', 'INVALID_CHARACTERS', 'invalid_characters'],
  ] as const)('구조 정책 %s를 bounded reason으로 변환한다', (password, code, reason) => {
    expect(
      policy.evaluateNewPassword(password, {
        email: 'student@kangwon.ac.kr',
        nickname: '감자친구',
      }),
    ).toMatchObject({ ok: false, code, reason });
  });
});
