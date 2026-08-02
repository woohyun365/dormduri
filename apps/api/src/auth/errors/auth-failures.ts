import type { GenericSuccessResult, LoginResult } from '../domain/auth.types.js';
import { AUTH_RESET_RESTART_REQUIRED_CODE } from '@repo/shared/auth/response';

interface AuthFailureOptions {
  userActionable?: boolean;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

function createFailure<TCode extends string>(
  code: TCode,
  error: string,
  options: AuthFailureOptions = {},
): GenericSuccessResult & {
  success: false;
  code: TCode;
  error: string;
  userActionable: boolean;
} {
  return {
    success: false,
    error,
    code,
    userActionable: options.userActionable ?? true,
    ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    ...(typeof options.retryAfterSeconds === 'number'
      ? { retryAfterSeconds: options.retryAfterSeconds }
      : {}),
  };
}

export const authFailures = {
  invalidKnuEmail() {
    return createFailure(
      'AUTH_INVALID_EMAIL_FORMAT',
      '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.',
      {
        fieldErrors: { email: '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.' },
      },
    );
  },

  signupValidation(error: string, fieldErrors: Record<string, string> = {}) {
    const normalizedFieldErrors = Object.fromEntries(
      Object.entries(fieldErrors).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );

    return createFailure('AUTH_SIGNUP_VALIDATION_FAILED', error, {
      fieldErrors: normalizedFieldErrors,
    });
  },

  emailAlreadyRegistered() {
    return createFailure('AUTH_EMAIL_ALREADY_REGISTERED', '이미 가입된 이메일입니다.', {
      fieldErrors: { email: '이미 가입된 이메일입니다.' },
    });
  },

  nicknameAlreadyTaken() {
    return createFailure('AUTH_NICKNAME_ALREADY_TAKEN', '이미 사용 중인 닉네임입니다.', {
      fieldErrors: { nickname: '이미 사용 중인 닉네임입니다.' },
    });
  },

  signupNicknameInvalid(error: string) {
    return createFailure('AUTH_SIGNUP_NICKNAME_INVALID', error, {
      fieldErrors: { nickname: error },
    });
  },

  signupNicknameNotAllowed(error: string) {
    return createFailure('AUTH_SIGNUP_NICKNAME_NOT_ALLOWED', error, {
      fieldErrors: { nickname: error },
    });
  },

  signupNicknameValidationThrottled(retryAfterSeconds: number) {
    return createFailure(
      'AUTH_SIGNUP_NICKNAME_VALIDATION_THROTTLED',
      '닉네임 확인 요청이 잠시 제한됐어요.',
      {
        userActionable: false,
        retryAfterSeconds,
      },
    );
  },

  signupSubmissionThrottled(retryAfterSeconds: number) {
    return createFailure('AUTH_SIGNUP_SUBMISSION_THROTTLED', '가입 요청이 잠시 제한됐어요.', {
      userActionable: false,
      retryAfterSeconds,
    });
  },

  signupCollegeUnavailable() {
    return createFailure(
      'AUTH_SIGNUP_COLLEGE_UNAVAILABLE',
      '선택한 캠퍼스의 단과대를 다시 선택해주세요.',
      {
        fieldErrors: {
          collegeCode: '선택한 캠퍼스의 단과대를 다시 선택해주세요.',
        },
      },
    );
  },

  signupVerificationRequired() {
    return createFailure(
      'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
      '이메일 인증을 먼저 완료해주세요.',
    );
  },

  legalAcceptanceStale() {
    return createFailure(
      'AUTH_LEGAL_ACCEPTANCE_STALE',
      '약관 또는 개인정보 동의 내용이 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해주세요.',
      {
        fieldErrors: {
          legalAcceptances:
            '약관 또는 개인정보 동의 내용이 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해주세요.',
        },
      },
    );
  },

  invalidCredentials(): LoginResult {
    return {
      ...createFailure('AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.'),
    };
  },

  loginLocked(remainingSeconds: number): LoginResult {
    return {
      ...createFailure('AUTH_LOGIN_LOCKED', '반복된 로그인 실패로 계정이 잠겼어요.', {
        userActionable: false,
      }),
      locked: true,
      remainingSeconds,
    };
  },

  verificationCodeInvalid() {
    return createFailure('AUTH_VERIFICATION_CODE_INVALID', '인증 코드가 올바르지 않습니다.', {
      fieldErrors: { code: '인증 코드가 올바르지 않습니다.' },
    });
  },

  resetRestartRequired() {
    return createFailure(
      AUTH_RESET_RESTART_REQUIRED_CODE,
      '비밀번호 재설정 요청을 다시 진행해주세요.',
      {
        userActionable: true,
      },
    );
  },

  passwordPolicyViolation(error: string, fieldName: 'password' | 'newPassword' = 'password') {
    return createFailure('AUTH_PASSWORD_POLICY_VIOLATION', error, {
      fieldErrors: { [fieldName]: error },
    });
  },

  samePasswordNotAllowed() {
    return createFailure(
      'AUTH_PASSWORD_UNCHANGED',
      '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
      {
        fieldErrors: {
          newPassword: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
        },
      },
    );
  },

  currentPasswordInvalid() {
    return createFailure('AUTH_CURRENT_PASSWORD_INVALID', '현재 비밀번호가 올바르지 않습니다.', {
      fieldErrors: {
        currentPassword: '현재 비밀번호가 올바르지 않습니다.',
      },
    });
  },

  reauthenticationRequired() {
    return createFailure('AUTH_REAUTHENTICATION_REQUIRED', '다시 로그인한 뒤 시도해주세요.', {
      userActionable: true,
    });
  },

  changePasswordThrottled(retryAfterSeconds: number) {
    return createFailure('AUTH_CHANGE_PASSWORD_THROTTLED', '비밀번호 변경이 잠시 제한됐어요.', {
      userActionable: false,
      retryAfterSeconds,
    });
  },

  sessionRenewalRequired() {
    return createFailure('AUTH_SESSION_RENEWAL_REQUIRED', '다시 로그인한 뒤 시도해주세요.', {
      userActionable: true,
    });
  },

  sessionRenewalStale(retryAfterMilliseconds: number) {
    return {
      ...createFailure(
        'AUTH_SESSION_RENEWAL_STALE',
        '다른 요청에서 로그인 상태를 갱신하고 있습니다.',
      ),
      retryAfterMilliseconds,
    };
  },

  sessionRenewalReused() {
    return createFailure(
      'AUTH_SESSION_RENEWAL_REUSED',
      '세션 보안을 위해 모든 로그인 상태를 종료했습니다. 다시 로그인해주세요.',
      {
        userActionable: true,
      },
    );
  },
};
