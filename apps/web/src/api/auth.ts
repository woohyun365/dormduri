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

async function requestJson<T>(
  path: string,
  init: RequestInit,
): Promise<{ status: number; data: T }> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  return {
    status: response.status,
    data: (await response.json()) as T,
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

function mapSendCodeError(
  status: number,
  data: {
    success?: boolean;
    error?: string;
    message?: string;
    retryAfterSeconds?: number;
  },
): string {
  if (status === 429) {
    if (typeof data.retryAfterSeconds === 'number') {
      return `너무 잦은 요청이에요. ${data.retryAfterSeconds}초 후 다시 시도해주세요.`;
    }
    return '너무 잦은 요청이에요. 잠시 후 다시 시도해주세요.';
  }
  if (status >= 500) {
    return '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
  }
  return data.error ?? data.message ?? '요청 처리에 실패했어요.';
}

export const authApi = {
  login: (
    email: LoginRequest['email'],
    password: LoginRequest['password'],
    rememberMe: LoginRequest['rememberMe'] = false,
  ): Promise<LoginResponse> => {
    return postJson<LoginResponse>('/api/auth/login', {
      email,
      password,
      rememberMe,
    });
  },

  verifyEmailCode: (
    email: VerificationCodeRequest['email'],
    code: VerificationCodeRequest['code'],
  ): Promise<VerifyCodeResponse> => {
    return postJson<VerifyCodeResponse>('/api/auth/verify-email-code', { email, code });
  },

  validateSignupDraft: (
    data: SignupDraftValidationRequest,
  ): Promise<SignupDraftValidationResponse> => {
    return postJson<SignupDraftValidationResponse>('/api/auth/validate-signup-draft', data);
  },

  /**
   * @deprecated Compatibility alias for the old signup basic-info naming.
   * Use validateSignupDraft for new BFF/API code.
   */
  validateSignupProfile: (
    data: SignupDraftValidationRequest,
  ): Promise<SignupDraftValidationResponse> => {
    return authApi.validateSignupDraft(data);
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
    return postJson<VerifyCodeResponse>('/api/auth/verify-reset-code', { email, code });
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
  ): Promise<{ success: boolean; error?: string }> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    const { status, data } = await requestJson<{
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
      return { success: false, error: mapSendCodeError(status, data) };
    }

    return { success: true };
  },

  sendResetCode: async (
    email: EmailRequest['email'],
  ): Promise<{ success: boolean; error?: string }> => {
    const formatError = validateKnuEmailFormat(email);
    if (formatError) {
      return { success: false, error: formatError };
    }

    const { status, data } = await requestJson<{
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
      return { success: false, error: mapSendCodeError(status, data) };
    }

    return { success: true };
  },
};
