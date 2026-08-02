import type {
  EmailRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupNicknameValidationRequest,
  SignupRequest,
  VerificationCodeRequest,
} from '@repo/shared/auth/contract';
import { validateKnuEmailFormat, validatePasswordStructure } from '@repo/shared/auth/policy';
import type {
  DevAuthUsersResponse,
  LoginResponse,
  ResetPasswordResponse,
  SignupNicknameValidationResponse,
  SignupResponse,
  VerifyCodeResponse,
} from '@repo/shared/auth/response';
import {
  browserSessionResolutionSchema,
  type BrowserSessionResolution,
} from '@repo/shared/auth/session';
import {
  AUTH_SESSION_STALE_RETRY_HEADER,
  AUTH_SESSION_STALE_RETRY_MAX_MILLISECONDS,
} from '@/auth/model/session-resolution.constants';

import type { AuthCodeRequestResult, AuthClientErrorBody } from './auth-api.types';
import {
  isSafeAuthInfrastructureError,
  mapAuthRequestError,
  mapLoginError,
  resolveRetryAfterSeconds,
  SERVER_ERROR_MESSAGE,
} from './error-mapper';
import { postJson, requestJson } from './request-json';

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

  validateSignupNickname: (
    data: SignupNicknameValidationRequest,
    signal?: AbortSignal,
  ): Promise<SignupNicknameValidationResponse> => {
    return requestJson<SignupNicknameValidationResponse>('/api/auth/signup/validate-nickname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    }).then(({ data: response }) => response);
  },

  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const passwordErr = validatePasswordStructure(data.password, data.email);
    if (passwordErr) {
      return {
        success: false,
        code: 'AUTH_PASSWORD_POLICY_VIOLATION',
        error: passwordErr,
        userActionable: true,
        fieldErrors: { password: passwordErr },
      };
    }

    return postJson<SignupResponse>('/api/auth/signup', data);
  },

  resetPassword: async (
    email: EmailRequest['email'],
    newPassword: ResetPasswordRequest['newPassword'],
    signal?: AbortSignal,
  ): Promise<ResetPasswordResponse> => {
    const passwordErr = validatePasswordStructure(newPassword, email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    const { status, data, retryAfterSeconds } = await requestJson<ResetPasswordResponse>(
      '/api/auth/reset-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
        signal,
      },
    );

    if (status >= 400 || data.success !== true) {
      const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
      return {
        ...data,
        success: false,
        error: isSafeAuthInfrastructureError(status, data)
          ? SERVER_ERROR_MESSAGE
          : mapAuthRequestError(status, data, retryAfterSeconds),
        ...(seconds !== undefined && data.retryAfterSeconds === undefined
          ? { retryAfterSeconds: seconds }
          : {}),
      };
    }

    return data;
  },

  verifyResetCode: (
    email: VerificationCodeRequest['email'],
    code: VerificationCodeRequest['code'],
    signal?: AbortSignal,
  ): Promise<VerifyCodeResponse> => {
    return verifyCode('/api/auth/verify-reset-code', email, code, signal);
  },

  resolveSession: async (signal?: AbortSignal): Promise<BrowserSessionResolution> => {
    const firstResolution = await requestBrowserSessionResolution(signal);
    const retryAfterMilliseconds = parseSessionRetryMilliseconds(
      firstResolution.headers.get(AUTH_SESSION_STALE_RETRY_HEADER),
    );

    if (retryAfterMilliseconds !== null) {
      await waitForSessionRetry(retryAfterMilliseconds, signal);
      const retriedResolution = await requestBrowserSessionResolution(signal);
      return parseBrowserSessionResolution(retriedResolution.data);
    }

    return parseBrowserSessionResolution(firstResolution.data);
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

  sendSignupCode: async (email: EmailRequest['email']): Promise<AuthCodeRequestResult> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    return sendCode('/api/auth/send-signup-code', email);
  },

  sendResetCode: async (
    email: EmailRequest['email'],
    signal?: AbortSignal,
  ): Promise<AuthCodeRequestResult> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    return sendCode('/api/auth/send-reset-code', email, signal);
  },
};

function requestBrowserSessionResolution(signal?: AbortSignal) {
  return requestJson<BrowserSessionResolution>('/api/auth/session/resolve', {
    method: 'POST',
    cache: 'no-store',
    signal,
  });
}

function parseBrowserSessionResolution(data: BrowserSessionResolution) {
  const parsed = browserSessionResolutionSchema.safeParse(data);
  return parsed.success
    ? parsed.data
    : ({ status: 'unavailable', code: 'AUTH_SESSION_UNAVAILABLE' } as const);
}

function parseSessionRetryMilliseconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, AUTH_SESSION_STALE_RETRY_MAX_MILLISECONDS);
}

function waitForSessionRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(new DOMException('aborted', 'AbortError'));
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

async function sendCode(
  path: '/api/auth/send-signup-code' | '/api/auth/send-reset-code',
  email: EmailRequest['email'],
  signal?: AbortSignal,
): Promise<AuthCodeRequestResult> {
  const { status, data, retryAfterSeconds } = await requestJson<AuthClientErrorBody>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
    signal,
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
}

async function verifyCode(
  path: '/api/auth/verify-email-code' | '/api/auth/verify-reset-code',
  email: VerificationCodeRequest['email'],
  code: VerificationCodeRequest['code'],
  signal?: AbortSignal,
): Promise<VerifyCodeResponse> {
  const { status, data, retryAfterSeconds } = await requestJson<VerifyCodeResponse>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
    signal,
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
