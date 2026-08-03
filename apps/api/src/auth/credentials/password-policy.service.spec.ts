import { describe, expect, it } from 'vitest';
import { AuthPasswordPolicyService } from './password-policy.service.js';

describe('AuthPasswordPolicyService', () => {
  const policy = new AuthPasswordPolicyService();

  it.each(['Password1!', 'PASSWORD1!', 'abcdefghij', '1234567890', 'knuroommate2026'])(
    '대표 common/service value %s를 exact lookup으로 거절한다',
    (password) => {
      expect(
        policy.evaluateNewPassword(password, {
          email: 'student@kangwon.ac.kr',
          nickname: '감자친구',
        }),
      ).toEqual({ ok: false, code: 'COMMON_VALUE' });
    },
  );

  it.each([
    ['longstudent@kangwon.ac.kr', 'longstudent@kangwon.ac.kr', '감자친구'],
    ['longstudent', 'longstudent@kangwon.ac.kr', '감자친구'],
    ['knuStudent', 'knuStudent@kangwon.ac.kr', '감자친구'],
    ['LongNickname', 'student@kangwon.ac.kr', 'longnickname'],
  ])(
    'email/local-part/nickname와 같은 값 %s를 contextual value로 거절한다',
    (password, email, nickname) => {
      expect(policy.evaluateNewPassword(password, { email, nickname })).toEqual({
        ok: false,
        code: 'CONTEXTUAL_VALUE',
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
});
