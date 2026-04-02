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
}

const STORAGE_KEYS = {
  users: 'mockdb-users',
  currentUser: 'mockdb-current-user',
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
  nextSeasonRegistered: true,
  unreadMessages: 0,
};

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

function readUsers(): MockUser[] {
  return readJson<MockUser[]>(STORAGE_KEYS.users, []).map(patchLegacyUser);
}

function writeUsers(users: MockUser[]): void {
  writeJson(STORAGE_KEYS.users, users);
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
  createUser(data: MockUser): void {
    this.upsertUser(data);
    console.log(`[MockDB] 유저 생성: ${data.email} (${data.nickname})`);
  },

  upsertUser(data: MockUser): void {
    const users = readUsers();
    const nextUser = patchLegacyUser(data);
    const index = users.findIndex((user) => user.email === nextUser.email);
    if (index >= 0) {
      users[index] = { ...users[index], ...nextUser };
    } else {
      users.push(nextUser);
    }
    writeUsers(users);
  },

  /** currentUser + users 배열을 동시에 갱신 (건물 선택 등 프로필 변경 시 사용) */
  updateUser(email: string, patch: Partial<MockUser>): void {
    const users = readUsers();
    const target = users.find((u) => u.email === email);
    if (target) {
      Object.assign(target, patch);
      writeUsers(users);
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
    return readUsers();
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
    localStorage.removeItem(STORAGE_KEYS.homeDashboard);
    console.log('[MockDB] 데이터 초기화 완료');
  },
};
