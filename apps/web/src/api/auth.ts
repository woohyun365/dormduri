import type {
  EmailRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupProfileValidationRequest,
  SignupRequest,
  VerificationCodeRequest,
} from '@repo/shared/auth-contract';
import type {
  LoginResponse,
  ResetPasswordResponse,
  SessionResponse,
  SignupProfileValidationResponse,
  SignupResponse,
  VerifyCodeResponse,
} from '@repo/shared/auth-response';
import { validateKnuEmailFormat, validatePasswordStructure } from '@repo/shared/auth-policy';
import type { LifestyleData } from '@/types/lifestyle';

async function getMockDb() {
  if (process.env.NODE_ENV === 'development') {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    return mockDb;
  }
  return null;
}

async function syncCurrentUser(
  user: SessionResponse['user'] | LoginResponse['user'] | SignupResponse['user'],
  password: string = '',
) {
  const db = await getMockDb();
  if (!db || !user) return;
  const syncedUser = {
    id: user.id,
    email: user.email,
    password,
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
    dormitoryId: user.dormitoryId,
    lifestyle: user.lifestyle as LifestyleData,
    intro: user.intro,
  };
  db.upsertUser(syncedUser);
  db.setCurrentUser(syncedUser);
}

async function clearCurrentUser() {
  const db = await getMockDb();
  if (!db) return;
  db.setCurrentUser(null);
}

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

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
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
  login: async (
    email: LoginRequest['email'],
    password: LoginRequest['password'],
    rememberMe: LoginRequest['rememberMe'] = false,
  ): Promise<LoginResponse> => {
    const result = await postJson<LoginResponse>('/api/auth/login', {
      email,
      password,
      rememberMe,
    });

    if (result.success) {
      await syncCurrentUser(result.user, password);
    }

    return result;
  },

  verifyEmailCode: (
    email: VerificationCodeRequest['email'],
    code: VerificationCodeRequest['code'],
  ): Promise<VerifyCodeResponse> => {
    return postJson<VerifyCodeResponse>('/api/auth/verify-email-code', { email, code });
  },

  validateSignupProfile: (
    data: SignupProfileValidationRequest,
  ): Promise<SignupProfileValidationResponse> => {
    return postJson<SignupProfileValidationResponse>('/api/auth/validate-signup-profile', data);
  },

  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const passwordErr = validatePasswordStructure(data.password, data.email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    const result = await postJson<SignupResponse>('/api/auth/signup', data);
    if (result.success) {
      await syncCurrentUser(result.user, data.password);
    }
    return result;
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

    if (status === 200 && data.authenticated && data.user) {
      await syncCurrentUser(data.user);
      return data;
    }

    await clearCurrentUser();
    return { authenticated: false };
  },

  logout: async (): Promise<void> => {
    await postJson<{ success: boolean }>('/api/auth/logout', {});
    await clearCurrentUser();
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
