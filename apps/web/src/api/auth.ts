import type { LifestyleData } from '@/types/lifestyle';
import type { Campus } from '@/types/profile';
import { validatePassword, validateNickname } from '@/utils/validation';

interface LoginResponse {
  success: boolean;
  token?: string;
  error?: string;
  locked?: boolean;
  remainingSeconds?: number;
}

interface VerifyCodeResponse {
  success: boolean;
  error?: string;
}

interface SignupResponse {
  success: boolean;
  error?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  error?: string;
}

interface AuthUserBridge {
  id: string;
  email: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
  lifestyle: LifestyleData;
  intro: string;
  dormitoryId: string | null;
  lastDrinkingChangeSeasonId: string | null;
}

async function getMockDb() {
  if (process.env.NODE_ENV === 'development') {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    return mockDb;
  }
  return null;
}

async function syncCurrentUser(user: AuthUserBridge | undefined) {
  const db = await getMockDb();
  if (!db || !user) return;
  db.setCurrentUser({
    id: user.id,
    email: user.email,
    password: '',
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
    dormitoryId: user.dormitoryId,
    lifestyle: user.lifestyle,
    intro: user.intro,
    lastDrinkingChangeSeasonId: user.lastDrinkingChangeSeasonId,
  });
}

async function clearCurrentUser() {
  const db = await getMockDb();
  if (!db) return;
  db.setCurrentUser(null);
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });

  return (await response.json()) as T;
}

export const authApi = {
  login: async (
    email: string,
    password: string,
    rememberMe: boolean = false,
  ): Promise<LoginResponse> => {
    const result = await postJson<LoginResponse & { user?: AuthUserBridge }>('/api/auth/login', {
      email,
      password,
      rememberMe,
    });

    if (result.success) {
      await syncCurrentUser(result.user);
    }

    return result;
  },

  verifyEmailCode: async (email: string, code: string): Promise<VerifyCodeResponse> => {
    return postJson<VerifyCodeResponse>('/api/auth/verify-email-code', { email, code });
  },

  signup: async (data: {
    email: string;
    password: string;
    nickname: string;
    gender: 'M' | 'F';
    campus: Campus;
    lifestyle: LifestyleData;
    intro: string;
  }): Promise<SignupResponse> => {
    // 서버 측 비밀번호 정책 검증 (백엔드 연동 시 서버에서 동일 검증 수행)
    const passwordErr = validatePassword(data.password, data.email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    // 서버 측 닉네임 정책 검증
    const nicknameErr = validateNickname(data.nickname);
    if (nicknameErr) {
      return { success: false, error: nicknameErr };
    }

    const result = await postJson<SignupResponse & { user?: AuthUserBridge }>(
      '/api/auth/signup',
      data,
    );
    if (result.success) {
      await syncCurrentUser(result.user);
    }
    return result;
  },

  resetPassword: async (email: string, newPassword: string): Promise<ResetPasswordResponse> => {
    const passwordErr = validatePassword(newPassword, email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    return postJson<ResetPasswordResponse>('/api/auth/reset-password', { email, newPassword });
  },

  verifyResetCode: async (email: string, code: string): Promise<VerifyCodeResponse> => {
    return postJson<VerifyCodeResponse>('/api/auth/verify-reset-code', { email, code });
  },

  logout: async (): Promise<void> => {
    await postJson<{ success: boolean }>('/api/auth/logout', {});
    await clearCurrentUser();
  },

  sendSignupCode: async (email: string): Promise<{ success: boolean; error?: string }> => {
    return postJson<{ success: boolean; error?: string }>('/api/auth/send-signup-code', { email });
  },

  sendResetCode: async (email: string): Promise<{ success: boolean; error?: string }> => {
    return postJson<{ success: boolean; error?: string }>('/api/auth/send-reset-code', { email });
  },
};
