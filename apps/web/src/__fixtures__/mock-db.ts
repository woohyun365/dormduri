import type { LifestyleData } from '@/types/lifestyle';
import type { Campus } from '@/types/profile';

export interface MockUser {
  id: string;
  email: string;
  password: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
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

/** 구 스키마(id/campus 누락) 데이터를 현재 스키마로 보정 */
function patchLegacyUser(user: MockUser): MockUser {
  return {
    ...user,
    id: user.id || crypto.randomUUID(),
    campus: user.campus || 'CHUNCHEON',
  };
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
    const found = users.find((u) => u.email === email && u.password === password);
    return found ? patchLegacyUser(found) : null;
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

  /** currentUser + users 배열을 동시에 갱신 (건물 선택 등 프로필 변경 시 사용) */
  updateUser(email: string, patch: Partial<MockUser>): void {
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    const target = users.find((u) => u.email === email);
    if (target) {
      Object.assign(target, patch);
      writeJson(STORAGE_KEYS.users, users);
    }
    const current = readJson<MockUser | null>(STORAGE_KEYS.currentUser, null);
    if (current && current.email === email) {
      Object.assign(current, patch);
      writeJson(STORAGE_KEYS.currentUser, current);
    }
  },

  setCurrentUser(user: MockUser | null): void {
    writeJson(STORAGE_KEYS.currentUser, user);
  },

  getCurrentUser(): MockUser | null {
    const user = readJson<MockUser | null>(STORAGE_KEYS.currentUser, null);
    return user ? patchLegacyUser(user) : null;
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
