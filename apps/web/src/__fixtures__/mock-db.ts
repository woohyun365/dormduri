import type { LifestyleData } from '@/types/lifestyle';

export interface MockUser {
  email: string;
  password: string;
  nickname: string;
  gender: 'M' | 'F';
  dormitoryId: string | null;
  lifestyle: LifestyleData;
  intro: string;
}

const STORAGE_KEYS = {
  users: 'mockdb-users',
  currentUser: 'mockdb-current-user',
} as const;

// 인증 코드는 세션 내에서만 유효하므로 인메모리 유지
const verificationCodes: Map<string, string> = new Map();

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

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
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    users.push(data);
    writeJson(STORAGE_KEYS.users, users);
    console.log(`[MockDB] 유저 생성: ${data.email} (${data.nickname})`);
  },

  findUser(email: string, password: string): MockUser | null {
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    return users.find((u) => u.email === email && u.password === password) ?? null;
  },

  findByEmail(email: string): MockUser | null {
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    return users.find((u) => u.email === email) ?? null;
  },

  resetPassword(email: string, newPassword: string): boolean {
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    const user = users.find((u) => u.email === email);
    if (!user) return false;
    user.password = newPassword;
    writeJson(STORAGE_KEYS.users, users);
    console.log(`[MockDB] 비밀번호 재설정: ${email}`);
    return true;
  },

  setCurrentUser(user: MockUser | null): void {
    writeJson(STORAGE_KEYS.currentUser, user);
  },

  getCurrentUser(): MockUser | null {
    return readJson<MockUser | null>(STORAGE_KEYS.currentUser, null);
  },

  /** 회원가입으로 생성된 유저 목록 반환 (DevPanel용) */
  getRegisteredUsers(): MockUser[] {
    return readJson<MockUser[]>(STORAGE_KEYS.users, []);
  },

  /** localStorage의 mockDb 데이터 전체 초기화 (DevPanel용) */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.users);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    verificationCodes.clear();
    console.log('[MockDB] 데이터 초기화 완료');
  },
};
