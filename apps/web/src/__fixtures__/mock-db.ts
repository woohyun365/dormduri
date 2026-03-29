import type { LifestyleData } from '@/types/lifestyle';
import type { Campus } from '@/types/profile';
import type { HomeDashboardState } from '@/main/types/home';

/** crypto.randomUUID() 폴백 (HTTP+IP 환경에서 Secure Context 미충족 시) */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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
  lastDrinkingChangeSeasonId: string | null;
}

const STORAGE_KEYS = {
  users: 'mockdb-users',
  currentUser: 'mockdb-current-user',
  loginAttempts: 'mockdb-login-attempts',
  homeDashboard: 'mockdb-home-dashboard',
} as const;

const DEFAULT_HOME_DASHBOARD_STATE: HomeDashboardState = {
  buildingStats: {
    totalParticipants: 135,
    assignedParticipants: 120,
    todayNewTotal: 5,
    todayNewBuilding: 2,
    totalMatchSuccess: 8,
    buildingMatchSuccess: 3,
  },
  pastSeason: 'none',
  nextSeasonRegisteredOverride: null,
};

// 인증 코드는 세션 내에서만 유효하므로 인메모리 유지
const verificationCodes: Map<string, string> = new Map();
let lastIssuedCode: { email: string; code: string } | null = null;

type LoginAttemptsMap = Record<string, { failureCount: number; lockedUntil: number | null }>;

function readLoginAttempts(): LoginAttemptsMap {
  return readJson<LoginAttemptsMap>(STORAGE_KEYS.loginAttempts, {});
}

function writeLoginAttempts(data: LoginAttemptsMap): void {
  writeJson(STORAGE_KEYS.loginAttempts, data);
}

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
    id: user.id || generateId(),
    campus: user.campus || 'CHUNCHEON',
  };
}

export const mockDb = {
  issueCode(email: string): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes.set(email, code);
    lastIssuedCode = { email, code };
    console.log(`[MockDB] 인증 코드: ${email} → ${code}`);
    return code;
  },

  verifyCode(email: string, code: string): boolean {
    return verificationCodes.get(email) === code;
  },

  getLastCode(): { email: string; code: string } | null {
    return lastIssuedCode;
  },

  createUser(data: MockUser): void {
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    users.push(data);
    writeJson(STORAGE_KEYS.users, users);
    console.log(`[MockDB] 유저 생성: ${data.email} (${data.nickname})`);
  },

  /** 로그인 잠금 상태 확인. 잠금 만료 시 자동 리셋. */
  getLoginAttempts(email: string): { failureCount: number; lockedUntil: number | null } {
    const all = readLoginAttempts();
    const attempts = all[email] ?? { failureCount: 0, lockedUntil: null };
    // 잠금 만료 시 리셋
    if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
      attempts.failureCount = 0;
      attempts.lockedUntil = null;
      all[email] = attempts;
      writeLoginAttempts(all);
    }
    return attempts;
  },

  /** 로그인 실패 기록. 5회 도달 시 잠금 설정. */
  recordLoginFailure(email: string): { locked: boolean; remainingSeconds: number } {
    const all = readLoginAttempts();
    const attempts = all[email] ?? { failureCount: 0, lockedUntil: null };
    attempts.failureCount += 1;
    if (attempts.failureCount >= 5) {
      attempts.lockedUntil = Date.now() + 300_000; // 5분
    }
    all[email] = attempts;
    writeLoginAttempts(all);
    return attempts.failureCount >= 5
      ? { locked: true, remainingSeconds: 300 }
      : { locked: false, remainingSeconds: 0 };
  },

  /** 로그인 성공 시 실패 카운트 리셋 */
  resetLoginAttempts(email: string): void {
    const all = readLoginAttempts();
    delete all[email];
    writeLoginAttempts(all);
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

  resetPassword(email: string, newPassword: string): { success: boolean; error?: string } {
    const users = readJson<MockUser[]>(STORAGE_KEYS.users, []);
    const user = users.find((u) => u.email === email);
    if (!user) return { success: false, error: '등록되지 않은 이메일입니다.' };
    if (user.password === newPassword) {
      return { success: false, error: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.' };
    }
    user.password = newPassword;
    writeJson(STORAGE_KEYS.users, users);
    console.log(`[MockDB] 비밀번호 재설정: ${email}`);
    return { success: true };
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

  getHomeDashboardState(): HomeDashboardState {
    return readJson<HomeDashboardState>(STORAGE_KEYS.homeDashboard, DEFAULT_HOME_DASHBOARD_STATE);
  },

  setHomeDashboardState(
    patch: Partial<Omit<HomeDashboardState, 'buildingStats'>> & {
      buildingStats?: Partial<HomeDashboardState['buildingStats']>;
    },
  ): HomeDashboardState {
    const current = this.getHomeDashboardState();
    const next: HomeDashboardState = {
      ...current,
      ...patch,
      buildingStats: {
        ...current.buildingStats,
        ...(patch.buildingStats ?? {}),
      },
    };
    writeJson(STORAGE_KEYS.homeDashboard, next);
    return next;
  },

  resetHomeDashboardState(): void {
    writeJson(STORAGE_KEYS.homeDashboard, DEFAULT_HOME_DASHBOARD_STATE);
  },

  /** localStorage의 mockDb 데이터 전체 초기화 (DevPanel용) */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.users);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    localStorage.removeItem(STORAGE_KEYS.loginAttempts);
    localStorage.removeItem(STORAGE_KEYS.homeDashboard);
    verificationCodes.clear();
    console.log('[MockDB] 데이터 초기화 완료');
  },
};
