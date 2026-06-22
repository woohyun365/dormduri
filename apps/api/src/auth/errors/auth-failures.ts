import type { GenericSuccessResult, LoginResult } from '../domain/auth.types.js';
import type { SignupDraftValidationFieldErrors } from '@repo/shared/auth/response';

interface AuthFailureOptions {
  userActionable?: boolean;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

function createFailure(
  code: string,
  error: string,
  options: AuthFailureOptions = {},
): GenericSuccessResult {
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

  signupValidation(error: string, fieldErrors: SignupDraftValidationFieldErrors = {}) {
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
      ...createFailure('AUTH_LOGIN_LOCKED', '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.', {
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
      'AUTH_RESET_RESTART_REQUIRED',
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

  sessionRenewalRequired() {
    return createFailure('AUTH_SESSION_RENEWAL_REQUIRED', '다시 로그인한 뒤 시도해주세요.', {
      userActionable: true,
    });
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
