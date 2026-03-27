/**
 * Mock Matching Service — Sprint 7 BE 상태 머신의 클라이언트 모방.
 * localStorage 영속. Sprint 7에서 matchingApi 내부를 HTTP로 교체하면 이 파일 폐기.
 */
import { MATCH_POLICY } from '@/constants/match';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import { isRequestExpired } from '@/utils/matchRequest';
import type { MatchRequest, ActiveMatch, MatchScoreType } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

// ── Storage ──────────────────────────────────────────────────────

const STORAGE_KEY = 'mock-matching-state';
const PRESET_KEY = 'devpanel-match-preset';

export interface MatchingState {
  requests: MatchRequest[];
  activeMatch: ActiveMatch | null;
}

export interface MatchingResult {
  requests: MatchRequest[];
  activeMatch: ActiveMatch | null;
}

// ── Presets ───────────────────────────────────────────────────────

export type MatchPreset = 'empty' | 'requests' | 'conversation' | 'active' | 'full';

export const MATCH_PRESETS: { value: MatchPreset | 'auto'; label: string }[] = [
  { value: 'auto', label: '자동 (저장된 상태)' },
  { value: 'empty', label: '빈 상태' },
  { value: 'requests', label: '요청 있음 (보낸2+받은1)' },
  { value: 'conversation', label: '대화 중' },
  { value: 'active', label: '매칭 확정' },
  { value: 'full', label: '전체 (요청+대화+이력)' },
];

function createPresetData(preset: MatchPreset, userId: string): MatchingState {
  const far = '2099-01-01T00:00:00.000Z';
  const farExp = '2099-01-06T00:00:00.000Z';
  const past = '2020-01-01T00:00:00.000Z';
  const base = {
    rejectedAt: null,
    acceptedAt: null,
    resolvedAt: null,
  };

  switch (preset) {
    case 'empty':
      return { requests: [], activeMatch: null };

    case 'requests':
      return {
        requests: [
          {
            id: 'p-req-001',
            fromUserId: userId,
            toUserId: '1',
            status: 'PENDING',
            message: '같이 룸메 해요!',
            createdAt: far,
            expiresAt: farExp,
            ...base,
          },
          {
            id: 'p-req-002',
            fromUserId: userId,
            toUserId: '2',
            status: 'PENDING',
            message: null,
            createdAt: far,
            expiresAt: farExp,
            ...base,
          },
          {
            id: 'p-req-003',
            fromUserId: '3',
            toUserId: userId,
            status: 'PENDING',
            message: '생활 패턴이 비슷해서 요청드립니다',
            createdAt: far,
            expiresAt: farExp,
            ...base,
          },
        ],
        activeMatch: null,
      };

    case 'conversation':
      return {
        requests: [
          {
            id: 'p-req-010',
            fromUserId: '3',
            toUserId: userId,
            status: 'IN_CONVERSATION',
            message: '취침 시간이 비슷해요!',
            createdAt: far,
            expiresAt: farExp,
            ...base,
            acceptedAt: far,
          },
          {
            id: 'p-req-011',
            fromUserId: userId,
            toUserId: '1',
            status: 'PENDING',
            message: '룸메 해요!',
            createdAt: far,
            expiresAt: farExp,
            ...base,
          },
        ],
        activeMatch: null,
      };

    case 'active':
      return {
        requests: [
          {
            id: 'p-req-020',
            fromUserId: '3',
            toUserId: userId,
            status: 'ACTIVE',
            message: '잘 지내요!',
            createdAt: far,
            expiresAt: farExp,
            ...base,
            acceptedAt: far,
          },
        ],
        activeMatch: {
          matchId: 'p-match-001',
          partnerUserId: '3',
          partnerNickname: '하늘바라기',
          partnerDormitoryId: 'dasan',
          matchScore: 87,
          scoreType: 'full' as MatchScoreType,
          matchedAt: far,
          cancelRequestedAt: null,
          cancelRequestedBy: null,
        },
      };

    case 'full':
      return {
        requests: [
          {
            id: 'p-req-030',
            fromUserId: userId,
            toUserId: '1',
            status: 'PENDING',
            message: '같이 룸메 해요!',
            createdAt: far,
            expiresAt: farExp,
            ...base,
          },
          {
            id: 'p-req-031',
            fromUserId: '3',
            toUserId: userId,
            status: 'PENDING',
            message: '생활 패턴이 비슷해서 요청드립니다',
            createdAt: far,
            expiresAt: farExp,
            ...base,
          },
          {
            id: 'p-req-032',
            fromUserId: '6',
            toUserId: userId,
            status: 'IN_CONVERSATION',
            message: '취침 시간이 비슷해요!',
            createdAt: far,
            expiresAt: farExp,
            ...base,
            acceptedAt: far,
          },
          {
            id: 'p-req-033',
            fromUserId: userId,
            toUserId: '4',
            status: 'REJECTED',
            message: null,
            createdAt: past,
            expiresAt: past,
            ...base,
            rejectedAt: past,
            resolvedAt: past,
          },
          {
            id: 'p-req-034',
            fromUserId: userId,
            toUserId: '5',
            status: 'EXPIRED',
            message: null,
            createdAt: past,
            expiresAt: past,
            ...base,
            resolvedAt: past,
          },
          {
            id: 'p-req-035',
            fromUserId: userId,
            toUserId: '8',
            status: 'CANCELLED',
            message: null,
            createdAt: past,
            expiresAt: past,
            ...base,
            resolvedAt: past,
          },
          {
            id: 'p-req-036',
            fromUserId: userId,
            toUserId: '7',
            status: 'CONVERSATION_ENDED',
            message: null,
            createdAt: past,
            expiresAt: past,
            ...base,
            acceptedAt: past,
            resolvedAt: past,
          },
          {
            id: 'p-req-037',
            fromUserId: '9',
            toUserId: userId,
            status: 'UNMATCHED',
            message: '잘 지내요!',
            createdAt: past,
            expiresAt: past,
            ...base,
            acceptedAt: past,
            resolvedAt: past,
          },
        ],
        activeMatch: null,
      };
  }
}

// ── Service ──────────────────────────────────────────────────────

let idCounter = Date.now();

export class MockMatchingService {
  private state: MatchingState;

  constructor() {
    this.state = this.load();
  }

  // --- Persistence ---

  private load(): MatchingState {
    if (typeof window === 'undefined') return { requests: [], activeMatch: null };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { requests: [], activeMatch: null };
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  // --- Preset ---

  initFromPreset(preset: MatchPreset, userId: string): void {
    this.state = createPresetData(preset, userId);
    this.save();
  }

  clearState(): void {
    this.state = { requests: [], activeMatch: null };
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }

  static getPresetOverride(): MatchPreset | null {
    if (typeof window === 'undefined') return null;
    const val = localStorage.getItem(PRESET_KEY);
    if (val && ['empty', 'requests', 'conversation', 'active', 'full'].includes(val)) {
      return val as MatchPreset;
    }
    return null;
  }

  static setPresetOverride(preset: MatchPreset | 'auto'): void {
    if (typeof window === 'undefined') return;
    if (preset === 'auto') {
      localStorage.removeItem(PRESET_KEY);
    } else {
      localStorage.setItem(PRESET_KEY, preset);
    }
  }

  // --- Queries ---

  /** 만료된 PENDING을 EXPIRED로 자동 전이 (AC-F03) */
  private expireStaleRequests(): void {
    const now = new Date().toISOString();
    let changed = false;
    this.state.requests = this.state.requests.map((r) => {
      if (r.status === 'PENDING' && isRequestExpired(r)) {
        changed = true;
        return { ...r, status: 'EXPIRED' as const, resolvedAt: now };
      }
      return r;
    });
    if (changed) this.save();
  }

  getRequests(userId: string): MatchRequest[] {
    this.expireStaleRequests();
    return this.state.requests.filter((r) => r.fromUserId === userId || r.toUserId === userId);
  }

  /** 유저별 activeMatch 필터링 (리뷰 이슈 #4) */
  getActiveMatch(userId: string): ActiveMatch | null {
    if (!this.state.activeMatch) return null;
    // activeMatch의 상대가 이 유저의 ACTIVE 요청과 연결되는지 확인
    const hasActiveRequest = this.state.requests.some(
      (r) => r.status === 'ACTIVE' && (r.fromUserId === userId || r.toUserId === userId),
    );
    return hasActiveRequest ? this.state.activeMatch : null;
  }

  getState(userId: string): MatchingResult {
    this.expireStaleRequests();
    return {
      requests: this.getRequests(userId),
      activeMatch: this.getActiveMatch(userId),
    };
  }

  // --- Mutations ---

  sendRequest(fromId: string, toId: string, message: string | null): MatchingResult {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + MATCH_POLICY.REQUEST_TTL_HOURS);

    const request: MatchRequest = {
      id: `req-${++idCounter}`,
      fromUserId: fromId,
      toUserId: toId,
      status: 'PENDING',
      message,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rejectedAt: null,
      acceptedAt: null,
      resolvedAt: null,
    };
    this.state.requests.push(request);
    this.save();
    return this.getState(fromId);
  }

  cancelRequest(requestId: string, userId: string): MatchingResult {
    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'CANCELLED' as const, resolvedAt: now } : r,
    );
    this.save();
    return this.getState(userId);
  }

  acceptRequest(requestId: string, userId: string): MatchingResult {
    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'IN_CONVERSATION' as const, acceptedAt: now } : r,
    );
    this.save();
    return this.getState(userId);
  }

  rejectRequest(requestId: string, userId: string): MatchingResult {
    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId
        ? { ...r, status: 'REJECTED' as const, rejectedAt: now, resolvedAt: now }
        : r,
    );
    this.save();
    return this.getState(userId);
  }

  confirmMatch(
    requestId: string,
    userId: string,
    context: {
      profiles: Omit<RoommateProfile, 'matchScore'>[];
      userLifestyle: UserProfile['lifestyle'];
    },
  ): MatchingResult {
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request || request.status !== 'IN_CONVERSATION') return this.getState(userId);

    const partnerId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
    const partnerProfile = context.profiles.find((p) => p.id === partnerId);

    const scoreResult = partnerProfile
      ? calcMatchScoreWithGating(context.userLifestyle, partnerProfile.lifestyle)
      : { score: null, type: 'gated' as const };

    const now = new Date().toISOString();

    this.state.activeMatch = {
      matchId: `match-${++idCounter}`,
      partnerUserId: partnerId,
      partnerNickname: partnerProfile?.nickname ?? partnerId,
      partnerDormitoryId: partnerProfile?.dormitoryId ?? null,
      matchScore: scoreResult.score ?? 0,
      scoreType: scoreResult.type,
      matchedAt: now,
      cancelRequestedAt: null,
      cancelRequestedBy: null,
    };

    this.state.requests = this.state.requests.map((r) => {
      if (r.id === requestId) return { ...r, status: 'ACTIVE' as const };
      if (r.status === 'PENDING' && !isRequestExpired(r))
        return { ...r, status: 'CANCELLED' as const, resolvedAt: now };
      if (r.status === 'IN_CONVERSATION' && r.id !== requestId)
        return { ...r, status: 'CONVERSATION_ENDED' as const, resolvedAt: now };
      return r;
    });

    this.save();
    return this.getState(userId);
  }

  endConversation(requestId: string, userId: string): MatchingResult {
    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'CONVERSATION_ENDED' as const, resolvedAt: now } : r,
    );
    this.save();
    return this.getState(userId);
  }

  endMatch(userId: string): MatchingResult {
    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.status === 'ACTIVE' ? { ...r, status: 'UNMATCHED' as const, resolvedAt: now } : r,
    );
    this.state.activeMatch = null;
    this.save();
    return this.getState(userId);
  }
}

// Singleton
let instance: MockMatchingService | null = null;

export function getMockMatchingService(): MockMatchingService {
  if (!instance) instance = new MockMatchingService();
  return instance;
}

export function resetMockMatchingService(): void {
  instance = null;
}
