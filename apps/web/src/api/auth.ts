// TODO: BE API 연동 시 실제 endpoint로 교체

import type { LifestyleData } from '@/types/lifestyle';
import { validatePassword, validateNickname } from '@/utils/validation';

interface LoginResponse {
  success: boolean;
  token?: string;
  error?: string;
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

// development 전용 mockDb (dynamic import로 production 번들 제외)
async function getMockDb() {
  if (process.env.NODE_ENV === 'development') {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    return mockDb;
  }
  return null;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const db = await getMockDb();
    if (db) {
      const user = db.findUser(email, password);
      if (user) {
        document.cookie = 'auth-token=mock-dev-token; path=/';
        db.setCurrentUser(user);
        return { success: true, token: 'mock-dev-token' };
      }
      return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }
    // TODO: POST /api/auth/login
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  verifyEmailCode: async (email: string, code: string): Promise<VerifyCodeResponse> => {
    const db = await getMockDb();
    if (db) {
      if (db.verifyCode(email, code)) {
        return { success: true };
      }
      return { success: false, error: '인증 코드가 올바르지 않습니다.' };
    }
    // TODO: POST /api/auth/verify-email-code
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  signup: async (data: {
    email: string;
    password: string;
    nickname: string;
    gender: 'M' | 'F';
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

    const db = await getMockDb();
    if (db) {
      if (db.findByEmail(data.email)) {
        return { success: false, error: '이미 가입된 이메일입니다.' };
      }
      const newUser = { ...data, nickname: data.nickname.trim(), dormitoryId: null };
      db.createUser(newUser);
      db.setCurrentUser(newUser);
      document.cookie = 'auth-token=mock-dev-token; path=/';
      return { success: true };
    }
    // TODO: POST /api/auth/signup
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  resetPassword: async (email: string, newPassword: string): Promise<ResetPasswordResponse> => {
    const passwordErr = validatePassword(newPassword, email);
    if (passwordErr) {
      return { success: false, error: passwordErr };
    }

    const db = await getMockDb();
    if (db) {
      if (db.resetPassword(email, newPassword)) {
        return { success: true };
      }
      return { success: false, error: '등록되지 않은 이메일입니다.' };
    }
    // TODO: POST /api/auth/reset-password
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  verifyResetCode: async (email: string, code: string): Promise<VerifyCodeResponse> => {
    const db = await getMockDb();
    if (db) {
      if (db.verifyCode(email, code)) {
        return { success: true };
      }
      return { success: false, error: '인증 코드가 올바르지 않습니다.' };
    }
    // TODO: POST /api/auth/verify-reset-code
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  logout: async (): Promise<void> => {
    const db = await getMockDb();
    if (db) {
      db.setCurrentUser(null);
    }
    document.cookie = 'auth-token=; path=/; max-age=0';
  },

  /** development 전용: 인증 코드 발급 (콘솔에 출력) */
  sendVerificationCode: async (email: string): Promise<{ success: boolean; error?: string }> => {
    const db = await getMockDb();
    if (db) {
      db.issueCode(email);
      return { success: true };
    }
    // TODO: POST /api/auth/send-code
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },
};
