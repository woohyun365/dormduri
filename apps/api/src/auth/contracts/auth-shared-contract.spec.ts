import { describe, expect, it } from 'vitest';
import {
  changePasswordRequestSchema,
  renewSessionRequestSchema,
  signupDraftValidationRequestSchema,
  signupRequestSchema,
} from '@repo/shared/auth/contract';
import {
  loginRequestSchema as granularLoginRequestSchema,
  signupDraftValidationRequestSchema as granularSignupDraftValidationRequestSchema,
} from '@repo/shared/auth/contract';
import { validateKnuEmailFormat as granularValidateKnuEmailFormat } from '@repo/shared/auth/policy';
import {
  changePasswordResponseSchema,
  loginResponseSchema,
  renewSessionResponseSchema,
} from '@repo/shared/auth/response';
import { loginResponseSchema as granularLoginResponseSchema } from '@repo/shared/auth/response';
import { sessionResponseSchema as granularSessionResponseSchema } from '@repo/shared/auth/session';

const UNSUPPORTED_SIGNUP_PROFILE_PAYLOAD = {
  lifestyle: { bedtime: '22_24' },
  intro: '가입 단계 소개',
  additional: { grade: 2 },
} as const;

const SIGNUP_LEGAL_ACCEPTANCES = {
  termsVersionId: 'terms-of-service-2026-06-22',
  personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
  ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
  privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
} as const;

describe('auth shared contract guards', () => {
  it('signup request는 display identity와 academic identity 입력을 받고 profile orchestration 필드를 받지 않는다', () => {
    const signupAccountIdentityInput = {
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'IT',
      birthYear: 2002,
      legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
    } as const;

    expect(signupRequestSchema.parse(signupAccountIdentityInput)).toMatchObject({
      nickname: '테스터',
      collegeCode: 'IT',
      birthYear: 2002,
    });

    expect(
      signupRequestSchema.safeParse({
        ...signupAccountIdentityInput,
        legalAcceptances: undefined,
      }).success,
    ).toBe(false);

    expect(
      signupRequestSchema.safeParse({
        ...signupAccountIdentityInput,
        legalAcceptances: {
          ...SIGNUP_LEGAL_ACCEPTANCES,
          privacyPolicyVersionIdShown: '',
        },
      }).success,
    ).toBe(false);

    expect(
      signupRequestSchema.safeParse({
        ...signupAccountIdentityInput,
        displayIdentity: { nickname: '테스터' },
      }).success,
    ).toBe(false);

    expect(
      signupRequestSchema.safeParse({
        ...signupAccountIdentityInput,
        ...UNSUPPORTED_SIGNUP_PROFILE_PAYLOAD,
      }).success,
    ).toBe(false);
  });

  it('signup request는 개인정보 수집·이용 동의와 개인정보 처리방침 표시 evidence를 분리한다', () => {
    const parsed = signupRequestSchema.parse({
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'IT',
      birthYear: 2002,
      legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
    });

    expect(parsed.legalAcceptances).toMatchObject({
      personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
      privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
    });
  });

  it('canonical granular auth subpath는 request/response/session schema surface를 제공한다', () => {
    const loginInput = {
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      rememberMe: true,
    } as const;
    const sessionResponse = { authenticated: false } as const;
    const opaqueAccessToken = `v1.session-1.${'a'.repeat(43)}`;

    expect(granularLoginRequestSchema.parse(loginInput)).toEqual(loginInput);
    expect(
      granularSignupDraftValidationRequestSchema.parse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
      }),
    ).toMatchObject({ nickname: '테스터' });
    expect(granularValidateKnuEmailFormat('student@kangwon.ac.kr')).toBe('');
    expect(
      granularLoginResponseSchema.safeParse({
        success: true,
        accessToken: opaqueAccessToken,
      }).success,
    ).toBe(true);
    expect(granularSessionResponseSchema.parse(sessionResponse)).toEqual(sessionResponse);
  });

  it('signup draft validation request는 legacy profile payload 없이 email/password/nickname만 받는다', () => {
    expect(
      signupDraftValidationRequestSchema.parse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
      }),
    ).toEqual({
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
    });

    expect(
      signupDraftValidationRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        ...UNSUPPORTED_SIGNUP_PROFILE_PAYLOAD,
        profile: { intro: 'signup 단계 프로필' },
      }).success,
    ).toBe(false);
  });

  it('change password request는 로그인 상태 currentPassword와 newPassword만 받는다', () => {
    expect(
      changePasswordRequestSchema.parse({
        currentPassword: 'OldPass1234',
        newPassword: 'NewPass1234',
      }),
    ).toEqual({
      currentPassword: 'OldPass1234',
      newPassword: 'NewPass1234',
    });

    expect(
      changePasswordRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        code: '123456',
        newPassword: 'NewPass1234',
      }).success,
    ).toBe(false);
  });

  it('renew session contract는 renewalToken rotation transport만 받고 JWT-like access token을 거부한다', () => {
    const opaqueAccessToken = `v1.session-1.${'a'.repeat(43)}`;
    const opaqueRenewalToken = `v1.session-1.${'b'.repeat(43)}`;

    expect(
      renewSessionRequestSchema.parse({
        renewalToken: 'v1.session-1.renewal-token',
      }),
    ).toEqual({
      renewalToken: 'v1.session-1.renewal-token',
    });

    expect(
      renewSessionRequestSchema.safeParse({
        accessToken: 'short-access-jwt',
      }).success,
    ).toBe(false);

    expect(
      renewSessionResponseSchema.parse({
        success: true,
        accessToken: opaqueAccessToken,
        renewalToken: opaqueRenewalToken,
        rememberMe: true,
      }),
    ).toMatchObject({
      success: true,
      rememberMe: true,
    });

    expect(
      loginResponseSchema.safeParse({
        success: true,
        accessToken: opaqueAccessToken,
        renewalToken: opaqueRenewalToken,
        rememberMe: true,
      }).success,
    ).toBe(true);
    expect(
      changePasswordResponseSchema.safeParse({
        success: true,
        accessToken: opaqueAccessToken,
        renewalToken: opaqueRenewalToken,
        rememberMe: true,
      }).success,
    ).toBe(true);

    for (const schema of [
      loginResponseSchema,
      changePasswordResponseSchema,
      renewSessionResponseSchema,
    ]) {
      expect(
        schema.safeParse({
          success: true,
          accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
        }).success,
      ).toBe(false);
    }
  });
});
