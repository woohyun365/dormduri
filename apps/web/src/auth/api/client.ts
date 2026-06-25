import type {
  EmailRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupDraftValidationRequest,
  SignupRequest,
  VerificationCodeRequest,
} from '@repo/shared/auth/contract';
import { validateKnuEmailFormat, validatePasswordStructure } from '@repo/shared/auth/policy';
import type {
  DevAuthUsersResponse,
  LoginResponse,
  ResetPasswordResponse,
  SessionResponse,
  SignupDraftValidationResponse,
  SignupResponse,
  VerifyCodeResponse,
} from '@repo/shared/auth/response';

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

    const { status, data, retryAfterSeconds } = await requestJson<ResetPasswordResponse>(
      '/api/auth/reset-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, newPassword }),
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

  sendSignupCode: async (email: EmailRequest['email']): Promise<AuthCodeRequestResult> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    return sendCode('/api/auth/send-signup-code', email);
  },

  sendResetCode: async (email: EmailRequest['email']): Promise<AuthCodeRequestResult> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    return sendCode('/api/auth/send-reset-code', email);
  },
};

async function sendCode(
  path: '/api/auth/send-signup-code' | '/api/auth/send-reset-code',
  email: EmailRequest['email'],
): Promise<AuthCodeRequestResult> {
  const { status, data, retryAfterSeconds } = await requestJson<AuthClientErrorBody>(path, {
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
}

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
