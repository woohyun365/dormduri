import type { LifestyleData } from '@/types/lifestyle';

interface MockUser {
  email: string;
  password: string;
  nickname: string;
  gender: 'M' | 'F';
  lifestyle: LifestyleData;
  intro: string;
}

// 모듈 스코프 인메모리 스토어 (새로고침 시 초기화)
const users: MockUser[] = [];
const verificationCodes: Map<string, string> = new Map();

export const mockDb = {
  issueCode(email: string): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes.set(email, code);
    console.log(`[MockDB] 인증 코드: ${email} → ${code}`);
    return code;
  },

  verifyCode(email: string, code: string): boolean {
    return verificationCodes.get(email) === code;
  },

  createUser(data: MockUser): void {
    users.push(data);
    console.log(`[MockDB] 유저 생성: ${data.email} (${data.nickname})`);
  },

  findUser(email: string, password: string): MockUser | null {
    return users.find((u) => u.email === email && u.password === password) ?? null;
  },

  findByEmail(email: string): MockUser | null {
    return users.find((u) => u.email === email) ?? null;
  },

  resetPassword(email: string, newPassword: string): boolean {
    const user = users.find((u) => u.email === email);
    if (!user) return false;
    user.password = newPassword;
    console.log(`[MockDB] 비밀번호 재설정: ${email}`);
    return true;
  },
};
