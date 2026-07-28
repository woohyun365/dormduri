import { describe, expect, it } from 'vitest';
import { createNetworkSignupFailure, mapSignupFailure } from '../signup-failure-recovery';

describe('signup failure recovery', () => {
  it('이메일 인증 proof 실패는 전체 signup 초기화 신호로 변환한다', () => {
    expect(
      mapSignupFailure({
        success: false,
        code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
        error: '이메일 인증을 다시 완료해 주세요.',
      }),
    ).toEqual({
      kind: 'verification_expired',
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
      message: '이메일 인증을 다시 완료해 주세요.',
    });
  });

  it('닉네임 충돌은 로그인 정보 단계의 field recovery로 변환한다', () => {
    expect(
      mapSignupFailure({
        success: false,
        code: 'AUTH_NICKNAME_ALREADY_TAKEN',
        error: '이미 사용 중인 닉네임입니다.',
      }),
    ).toMatchObject({
      kind: 'field_error',
      targetStepId: 'ACCOUNT_CREDENTIALS',
      fieldErrors: { nickname: '이미 사용 중인 닉네임입니다.' },
    });
  });

  it('학교 정보 validation은 해당 입력 단계와 공개 가능한 필드 오류만 유지한다', () => {
    expect(
      mapSignupFailure({
        success: false,
        code: 'AUTH_SIGNUP_VALIDATION_FAILED',
        error: '입력값을 확인해 주세요.',
        fieldErrors: {
          campus: '캠퍼스를 확인해 주세요.',
          internalOnly: '노출하지 않음',
        },
      }),
    ).toMatchObject({
      kind: 'field_error',
      targetStepId: 'ACADEMIC_IDENTITY',
      fieldErrors: { campus: '캠퍼스를 확인해 주세요.' },
    });
  });

  it('복구 가능한 필드가 없는 validation과 네트워크 예외는 retryable로 유지한다', () => {
    expect(
      mapSignupFailure({
        success: false,
        code: 'AUTH_SIGNUP_VALIDATION_FAILED',
        error: '잠시 후 다시 시도해 주세요.',
      }),
    ).toMatchObject({ kind: 'retryable', code: 'UNKNOWN' });

    expect(createNetworkSignupFailure()).toMatchObject({
      kind: 'retryable',
      code: 'NETWORK_ERROR',
    });
  });
});
