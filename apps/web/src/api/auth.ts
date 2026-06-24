import type {
  EmailRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupDraftValidationRequest,
  SignupRequest,
  VerificationCodeRequest,
} from '@repo/shared/auth/contract';
import type {
  DevAuthUsersResponse,
  LoginResponse,
  ResetPasswordResponse,
  SessionResponse,
  SignupDraftValidationResponse,
  SignupResponse,
  VerifyCodeResponse,
} from '@repo/shared/auth/response';
import { validateKnuEmailFormat, validatePasswordStructure } from '@repo/shared/auth/policy';

const SERVER_ERROR_MESSAGE = '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';

async function requestJson<T>(
  path: string,
  init: RequestInit,
): Promise<{ status: number; data: T; retryAfterSeconds?: number }> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {
      success: false,
      code: 'BFF_RESPONSE_INVALID',
      error: SERVER_ERROR_MESSAGE,
      userActionable: true,
    } as T;
  }

  return {
    status: response.status,
    data,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const { data } = await requestJson<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return data;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return Math.ceil(numberValue);
}

function resolveRetryAfterSeconds(
  data: { retryAfterSeconds?: number },
  retryAfterSeconds?: number,
): number | undefined {
  const seconds =
    typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : retryAfterSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return Math.ceil(seconds);
}

function mapAuthRequestError(
  status: number,
  data: {
    success?: boolean;
    error?: string;
    message?: string;
    retryAfterSeconds?: number;
  },
  retryAfterSeconds?: number,
): string {
  if (status === 429) {
    const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
    if (typeof seconds === 'number') {
      return `너무 잦은 요청이에요. ${seconds}초 후 다시 시도해주세요.`;
    }
    return '너무 잦은 요청이에요. 잠시 후 다시 시도해주세요.';
  }
  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }
  return data.error ?? data.message ?? '요청 처리에 실패했어요.';
}

function isSafeLoginServerError(status: number, data: { code?: string }): boolean {
  return (
    status >= 500 ||
    data.code === 'INVALID_LOGIN_REQUEST' ||
    data.code === 'BFF_RESPONSE_INVALID' ||
    data.code?.startsWith('BFF_UPSTREAM_') === true
  );
}

function mapLoginError(
  status: number,
  data: {
    success?: boolean;
    error?: string;
    message?: string;
    retryAfterSeconds?: number;
    code?: string;
  },
  retryAfterSeconds?: number,
): string {
  if (isSafeLoginServerError(status, data)) {
    return SERVER_ERROR_MESSAGE;
  }

  return mapAuthRequestError(status, data, retryAfterSeconds);
}

export const authApi = {
  login: async (
    email: LoginRequest['email'],
    password: LoginRequest['password'],
    rememberMe: LoginRequest['rememberMe'] = false,
  ): Promise<LoginResponse> => {
    const { status, data, retryAfterSeconds } = await requestJson<LoginResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      },
    );

    if (status >= 400 || data.success !== true) {
      const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
      return {
        ...data,
        success: false,
        error: mapLoginError(status, data, retryAfterSeconds),
        ...(seconds !== undefined && data.retryAfterSeconds === undefined
          ? { retryAfterSeconds: seconds }
          : {}),
      };
    }

    return data;
  },

  verifyEmailCode: (
    email: VerificationCodeRequest['email'],
    code: VerificationCodeRequest['code'],
  ): Promise<VerifyCodeResponse> => {
    return verifyCode('/api/auth/verify-email-code', email, code);
  },

  validateSignupDraft: (
    data: SignupDraftValidationRequest,
  ): Promise<SignupDraftValidationResponse> => {
    return postJson<SignupDraftValidationResponse>('/api/auth/validate-signup-draft', data);
  },

  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const passwordErr = validatePasswordStructure(data.password, data.email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    return postJson<SignupResponse>('/api/auth/signup', data);
  },

  resetPassword: async (
    email: ResetPasswordRequest['email'],
    newPassword: ResetPasswordRequest['newPassword'],
  ): Promise<ResetPasswordResponse> => {
    const passwordErr = validatePasswordStructure(newPassword, email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    return postJson<ResetPasswordResponse>('/api/auth/reset-password', { email, newPassword });
  },

  verifyResetCode: (
    email: VerificationCodeRequest['email'],
    code: VerificationCodeRequest['code'],
  ): Promise<VerifyCodeResponse> => {
    return verifyCode('/api/auth/verify-reset-code', email, code);
  },

  getSession: async (): Promise<SessionResponse> => {
    const { status, data } = await requestJson<SessionResponse>('/api/auth/session', {
      method: 'GET',
      cache: 'no-store',
    });

    if (status === 200) {
      return data;
    }

    return { authenticated: false };
  },

  getDevUsers: async (): Promise<DevAuthUsersResponse> => {
    const { status, data } = await requestJson<DevAuthUsersResponse>('/api/auth/dev-users', {
      method: 'GET',
      cache: 'no-store',
    });

    if (status >= 400 || data.success !== true) {
      return {
        success: false,
        error: data.error ?? '개발용 유저 목록을 불러오지 못했습니다.',
      };
    }

    return data;
  },

  logout: async (): Promise<void> => {
    await postJson<{ success: boolean }>('/api/auth/logout', {});
  },

  sendSignupCode: async (
    email: EmailRequest['email'],
  ): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number }> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    const { status, data, retryAfterSeconds } = await requestJson<{
      success?: boolean;
      error?: string;
      message?: string;
      retryAfterSeconds?: number;
    }>('/api/auth/send-signup-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (status >= 400 || data.success !== true) {
      const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
      return {
        success: false,
        error: mapAuthRequestError(status, data, retryAfterSeconds),
        ...(seconds !== undefined ? { retryAfterSeconds: seconds } : {}),
      };
    }

    return { success: true };
  },

  sendResetCode: async (
    email: EmailRequest['email'],
  ): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number }> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    const { status, data, retryAfterSeconds } = await requestJson<{
      success?: boolean;
      error?: string;
      message?: string;
      retryAfterSeconds?: number;
    }>('/api/auth/send-reset-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (status >= 400 || data.success !== true) {
      const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
      return {
        success: false,
        error: mapAuthRequestError(status, data, retryAfterSeconds),
        ...(seconds !== undefined ? { retryAfterSeconds: seconds } : {}),
      };
    }

    return { success: true };
  },
};

async function verifyCode(
  path: '/api/auth/verify-email-code' | '/api/auth/verify-reset-code',
  email: VerificationCodeRequest['email'],
  code: VerificationCodeRequest['code'],
): Promise<VerifyCodeResponse> {
  const { status, data, retryAfterSeconds } = await requestJson<VerifyCodeResponse>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });

  if (status >= 400) {
    const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
    return {
      ...data,
      success: false,
      error: mapAuthRequestError(status, data, retryAfterSeconds),
      ...(seconds !== undefined && data.retryAfterSeconds === undefined
        ? { retryAfterSeconds: seconds }
        : {}),
    };
  }

  return data;
}
