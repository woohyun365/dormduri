import { describe, expect, it } from 'vitest';
import { createSignupRequest } from '../signup-request.mapper';

const legalAcceptances = {
  termsVersionId: 'terms-of-service-2026-06-22',
  personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
  ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
  privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
};

const validInput = {
  email: 'tester@kangwon.ac.kr',
  password: 'Test1234',
  nickname: '테스터',
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
  collegeCode: 'IT' as const,
  birthYear: 2002,
  legalAcceptances,
};

describe('createSignupRequest', () => {
  it('shared SignupRequest contract를 통과하는 final signup body를 만든다', () => {
    expect(createSignupRequest(validInput)).toEqual(validInput);
  });

  it('lifestyle/intro/profile/conditions 같은 signup 외부 필드를 출력하지 않는다', () => {
    const request = createSignupRequest({
      ...validInput,
      lifestyle: { bedtime: '23:00' },
      intro: '안녕하세요',
      profile: { intro: 'profile' },
      conditions: { cleanLevel: 'HIGH' },
    } as typeof validInput);

    expect(request).not.toHaveProperty('lifestyle');
    expect(request).not.toHaveProperty('intro');
    expect(request).not.toHaveProperty('profile');
    expect(request).not.toHaveProperty('conditions');
  });

  it('collegeCode/birthYear가 없으면 final request 생성을 거부한다', () => {
    expect(() =>
      createSignupRequest({
        ...validInput,
        collegeCode: undefined,
      } as unknown as typeof validInput),
    ).toThrow();
    expect(() =>
      createSignupRequest({
        ...validInput,
        birthYear: undefined,
      } as unknown as typeof validInput),
    ).toThrow();
  });
});
