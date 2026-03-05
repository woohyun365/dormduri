// TODO: BE API 연동 시 실제 endpoint로 교체

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

export const authApi = {
  login: async (_email: string, _password: string): Promise<LoginResponse> => {
    // TODO: POST /api/auth/login
    // 현재 BE API 미존재 — mock으로 항상 실패 반환
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  verifyEmailCode: async (_email: string, _code: string): Promise<VerifyCodeResponse> => {
    // TODO: POST /api/auth/verify-email-code
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  signup: async (_data: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupResponse> => {
    // TODO: POST /api/auth/signup
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  resetPassword: async (_email: string, _newPassword: string): Promise<ResetPasswordResponse> => {
    // TODO: POST /api/auth/reset-password
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  verifyResetCode: async (_email: string, _code: string): Promise<VerifyCodeResponse> => {
    // TODO: POST /api/auth/verify-reset-code
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },
};
