import { describe, expect, it } from 'vitest';
import {
  changePasswordRequestSchema,
  renewSessionRequestSchema,
  resetPasswordRequestSchema,
  signupNicknameValidationRequestSchema,
  signupRequestSchema,
} from '@repo/shared/auth/contract';
import {
  loginRequestSchema as granularLoginRequestSchema,
  signupNicknameValidationRequestSchema as granularSignupNicknameValidationRequestSchema,
} from '@repo/shared/auth/contract';
import { validateKnuEmailFormat as granularValidateKnuEmailFormat } from '@repo/shared/auth/policy';
import {
  AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED_CODE,
  AUTH_PASSWORD_CHANGED_LOGIN_REQUIRED_CODE,
  authSessionRenewalFailureCodeSchema,
  changePasswordResponseSchema,
  loginResponseSchema,
  renewSessionStaleResponseSchema,
  renewSessionResponseSchema,
  verifyCodeResponseSchema,
  verifyResetCodeTransportResponseSchema,
  verifySignupCodeTransportResponseSchema,
  signupResponseSchema,
} from '@repo/shared/auth/response';
import { loginResponseSchema as granularLoginResponseSchema } from '@repo/shared/auth/response';
import {
  apiSessionResponseSchema,
  browserSessionResolutionSchema,
} from '@repo/shared/auth/session';

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
  it('signup nickname 사전 검증은 email/password가 아닌 nickname만 받는다', () => {
    expect(
      signupNicknameValidationRequestSchema.safeParse({
        nickname: '테스터',
      }).success,
    ).toBe(true);
    expect(
      signupNicknameValidationRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
      }).success,
    ).toBe(false);
  });

  it('browser reset contract는 email/grant를 거부하고 transport verify contract만 raw grant를 허용한다', () => {
    const opaqueGrant = `v1.verification-code.${'g'.repeat(43)}`;

    expect(resetPasswordRequestSchema.parse({ newPassword: 'pass1234' })).toEqual({
      newPassword: 'pass1234',
    });
    expect(
      resetPasswordRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        newPassword: 'pass1234',
      }).success,
    ).toBe(false);
    expect(
      verifyResetCodeTransportResponseSchema.safeParse({
        success: true,
        resetGrant: opaqueGrant,
        grantExpiresInSeconds: 900,
      }).success,
    ).toBe(true);
    expect(
      verifySignupCodeTransportResponseSchema.safeParse({
        success: true,
        signupGrant: opaqueGrant,
        grantExpiresInSeconds: 900,
      }).success,
    ).toBe(true);
    expect(
      verifyCodeResponseSchema.safeParse({
        success: true,
        resetGrant: opaqueGrant,
        grantExpiresInSeconds: 900,
      }).success,
    ).toBe(false);
  });

  it('signup request는 display identity와 academic identity 입력을 받고 profile orchestration 필드를 받지 않는다', () => {
    const signupAccountIdentityInput = {
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
      legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
    } as const;

    expect(signupRequestSchema.parse(signupAccountIdentityInput)).toMatchObject({
      nickname: '테스터',
      collegeCode: 'CHUNCHEON_IT',
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
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
      legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
    });

    expect(parsed.legalAcceptances).toMatchObject({
      personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
      privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
    });
  });

  it('signup request는 campus와 college code가 같은 catalog에 속해야 한다', () => {
    expect(
      signupRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'SAMCHEOK',
        collegeCode: 'SAMCHEOK_ENGINEERING',
        birthYear: 2002,
        legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
      }).success,
    ).toBe(true);

    const mismatched = signupRequestSchema.safeParse({
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'SAMCHEOK',
      collegeCode: 'DOGYE_ENGINEERING',
      birthYear: 2002,
      legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
    });

    expect(mismatched.success).toBe(false);
    if (!mismatched.success) {
      expect(mismatched.error.issues[0]).toMatchObject({
        path: ['collegeCode'],
        message: '선택한 캠퍼스의 단과대를 다시 선택해주세요.',
      });
    }
  });

  it('canonical granular auth subpath는 request/response/session schema surface를 제공한다', () => {
    const loginInput = {
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      rememberMe: true,
    } as const;
    const sessionResponse = { authenticated: false, reason: 'MISSING_TOKEN' } as const;
    const opaqueAccessToken = `v1.session-1.${'a'.repeat(43)}`;

    expect(granularLoginRequestSchema.parse(loginInput)).toEqual(loginInput);
    expect(
      granularSignupNicknameValidationRequestSchema.parse({
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
    expect(apiSessionResponseSchema.parse(sessionResponse)).toEqual(sessionResponse);
  });

  it('signup nickname validation request는 nickname만 받는다', () => {
    expect(
      signupNicknameValidationRequestSchema.parse({
        nickname: '테스터',
      }),
    ).toEqual({
      nickname: '테스터',
    });

    expect(
      signupNicknameValidationRequestSchema.safeParse({
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
        rememberMe: false,
      }),
    ).toMatchObject({
      success: true,
      rememberMe: false,
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
    expect(
      signupResponseSchema.safeParse({
        success: true,
        accessToken: opaqueAccessToken,
        renewalToken: opaqueRenewalToken,
        rememberMe: false,
        user: {
          id: 'user-1',
          email: 'student@kangwon.ac.kr',
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
      }).success,
    ).toBe(true);
    expect(
      signupResponseSchema.safeParse({
        success: false,
        code: AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED_CODE,
        error: '계정이 생성됐어요. 로그인해 주세요.',
      }).success,
    ).toBe(true);
    expect(
      changePasswordResponseSchema.safeParse({
        success: false,
        code: AUTH_PASSWORD_CHANGED_LOGIN_REQUIRED_CODE,
        error: '비밀번호가 변경됐어요. 다시 로그인해 주세요.',
      }).success,
    ).toBe(true);

    for (const schema of [
      loginResponseSchema,
      signupResponseSchema,
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

  it('session contract는 API 인증 실패와 browser 가용성 실패를 서로 다른 축으로 표현한다', () => {
    expect(
      apiSessionResponseSchema.parse({
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'student@kangwon.ac.kr',
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
      }),
    ).toMatchObject({ authenticated: true });
    expect(
      apiSessionResponseSchema.parse({
        authenticated: false,
        reason: 'ACCESS_EXPIRED',
      }),
    ).toEqual({
      authenticated: false,
      reason: 'ACCESS_EXPIRED',
    });

    expect(
      browserSessionResolutionSchema.parse({
        status: 'unavailable',
        code: 'AUTH_SESSION_UNAVAILABLE',
      }),
    ).toEqual({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
    expect(
      browserSessionResolutionSchema.safeParse({
        status: 'authenticated',
      }).success,
    ).toBe(false);
    expect(
      browserSessionResolutionSchema.safeParse({
        status: 'unauthenticated',
        user: {
          id: 'must-not-leak',
          email: 'student@kangwon.ac.kr',
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
      }).success,
    ).toBe(false);
  });

  it('renewal stale contract는 retry budget을 millisecond 단위로 요구한다', () => {
    expect(authSessionRenewalFailureCodeSchema.parse('AUTH_SESSION_RENEWAL_STALE')).toBe(
      'AUTH_SESSION_RENEWAL_STALE',
    );
    expect(
      renewSessionStaleResponseSchema.parse({
        success: false,
        code: 'AUTH_SESSION_RENEWAL_STALE',
        retryAfterMilliseconds: 50,
      }),
    ).toEqual({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_STALE',
      retryAfterMilliseconds: 50,
    });
    expect(
      renewSessionStaleResponseSchema.safeParse({
        success: false,
        code: 'AUTH_SESSION_RENEWAL_STALE',
      }).success,
    ).toBe(false);
  });
});
