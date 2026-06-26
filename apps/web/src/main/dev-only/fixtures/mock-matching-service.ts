/**
 * Mock Matching Service — Sprint 7 BE 상태 머신의 클라이언트 모방.
 * localStorage 영속. Sprint 7에서 matchingApi 내부를 HTTP로 교체하면 이 파일 폐기.
 */
import { MATCH_POLICY } from '@/constants/match';
import { getMatchGroupSize } from '@/constants/dormitory';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import { doesRequestTargetUser, isRequestExpired } from '@/utils/matchRequest';
import type { MatchRequest, ActiveMatch, MatchScoreType } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';
import { mockRawProfiles } from './profiles';
import { mockDb } from './mock-db';

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

interface GroupScenarioUser {
  id: string;
  nickname: string;
  dormitoryId: string | null;
  gender?: 'M' | 'F';
}

function getDevFixtureCandidates(userId: string): Omit<RoommateProfile, 'matchScore'>[] {
  const currentUser = mockDb.getCurrentUser();
  const all = mockRawProfiles.filter((profile) => profile.id !== userId);

  if (!currentUser) return all;

  const sameDormitory = currentUser.dormitoryId
    ? all.filter(
        (profile) =>
          profile.dormitoryId === currentUser.dormitoryId &&
          profile.campus === currentUser.campus &&
          profile.gender === currentUser.gender,
      )
    : [];

  const sameCampus = all.filter(
    (profile) =>
      profile.campus === currentUser.campus &&
      profile.gender === currentUser.gender &&
      !sameDormitory.some((candidate) => candidate.id === profile.id),
  );

  const remaining = all.filter(
    (profile) =>
      !sameDormitory.some((candidate) => candidate.id === profile.id) &&
      !sameCampus.some((candidate) => candidate.id === profile.id),
  );

  return [...sameDormitory, ...sameCampus, ...remaining];
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
  // UrgentActionBanner 테스트용: 12시간 후 만료
  const urgentExp = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
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
          {
            id: 'p-req-004',
            fromUserId: '4',
            toUserId: userId,
            status: 'PENDING',
            message: '수면 시간이 비슷해서 연락드려요!',
            createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: urgentExp,
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
          cancelApprovalUserIds: [],
          cancelRequestKind: null,
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
            resolvedBy: '4',
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
            resolvedBy: 'system',
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
            resolvedBy: userId,
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
            resolvedBy: userId,
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
            resolvedBy: '9',
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

  /** DevTool 카운트 기반으로 요청 생성 (홈 통계와 매칭 탭 동기화) */
  initFromCounts(
    userId: string,
    counts: { sent?: number | null; received?: number | null; chats?: number | null },
  ): void {
    const far = '2099-01-01T00:00:00.000Z';
    const farExp = '2099-01-06T00:00:00.000Z';
    const past = '2020-01-01T00:00:00.000Z';
    const base = { rejectedAt: null, acceptedAt: null, resolvedAt: null };
    const requests: MatchRequest[] = [];
    const fixtureCandidates = getDevFixtureCandidates(userId);
    const usedFixtureIds = new Set<string>();
    let counter = 1000;
    let fixtureCursor = 0;

    const pickFixtureId = (fallbackId: string) => {
      while (fixtureCursor < fixtureCandidates.length) {
        const candidate = fixtureCandidates[fixtureCursor++]!;
        if (!usedFixtureIds.has(candidate.id)) {
          usedFixtureIds.add(candidate.id);
          return candidate.id;
        }
      }
      return fallbackId;
    };

    // 보낸 요청
    const sentCount = counts.sent ?? 0;
    for (let i = 0; i < sentCount; i++) {
      requests.push({
        id: `dev-sent-${++counter}`,
        fromUserId: userId,
        toUserId: pickFixtureId(String(i + 1)),
        status: 'PENDING',
        message: `테스트 보낸 요청 ${i + 1}`,
        createdAt: far,
        expiresAt: farExp,
        ...base,
      });
    }

    // 받은 요청
    const receivedCount = counts.received ?? 0;
    for (let i = 0; i < receivedCount; i++) {
      // 12시간 후 만료 (만료 임박 테스트용: 첫 번째)
      const exp = i === 0 ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() : farExp;
      requests.push({
        id: `dev-recv-${++counter}`,
        fromUserId: pickFixtureId(String(sentCount + i + 1)),
        toUserId: userId,
        status: 'PENDING',
        message: `테스트 받은 요청 ${i + 1}`,
        createdAt: far,
        expiresAt: exp,
        ...base,
      });
    }

    // 대화 중
    const chatsCount = counts.chats ?? 0;
    for (let i = 0; i < chatsCount; i++) {
      requests.push({
        id: `dev-conv-${++counter}`,
        fromUserId: pickFixtureId(String(sentCount + receivedCount + i + 1)),
        toUserId: userId,
        status: 'IN_CONVERSATION',
        message: `테스트 대화 ${i + 1}`,
        createdAt: far,
        expiresAt: farExp,
        ...base,
        acceptedAt: far,
      });
    }

    // 이력 (기본 2건 추가)
    requests.push({
      id: `dev-hist-${++counter}`,
      fromUserId: userId,
      toUserId: '98',
      status: 'EXPIRED',
      message: null,
      createdAt: past,
      expiresAt: past,
      ...base,
      resolvedAt: past,
      resolvedBy: 'system',
    });
    requests.push({
      id: `dev-hist-${++counter}`,
      fromUserId: '99',
      toUserId: userId,
      status: 'REJECTED',
      message: null,
      createdAt: past,
      expiresAt: past,
      ...base,
      rejectedAt: past,
      resolvedAt: past,
      resolvedBy: userId,
    });

    this.state = { requests, activeMatch: null };
    this.save();
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
        return { ...r, status: 'EXPIRED' as const, resolvedAt: now, resolvedBy: 'system' };
      }
      return r;
    });
    if (changed) this.save();
  }

  /** 취소 요청 3일 무응답 자동 승인 (MATCH_CANCEL만) */
  private autoApproveStaleCancelRequests(): void {
    if (!this.state.activeMatch?.cancelRequestedAt) return;
    if (this.state.activeMatch.cancelRequestKind !== 'MATCH_CANCEL') return;

    const requestedAt = new Date(this.state.activeMatch.cancelRequestedAt).getTime();
    if (!Number.isFinite(requestedAt)) return;
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - requestedAt < threeDaysMs) return;

    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.status === 'ACTIVE'
        ? {
            ...r,
            status: 'UNMATCHED' as const,
            resolvedAt: now,
            resolvedBy: this.state.activeMatch?.cancelRequestedBy ?? 'system',
          }
        : r,
    );
    this.state.activeMatch = null;
    this.save();
  }

  getRequests(userId: string): MatchRequest[] {
    this.expireStaleRequests();
    return this.state.requests.filter(
      (r) => r.fromUserId === userId || doesRequestTargetUser(r, userId),
    );
  }

  /** 유저별 activeMatch 필터링 (리뷰 이슈 #4) */
  getActiveMatch(userId: string): ActiveMatch | null {
    if (!this.state.activeMatch) return null;

    if (this.state.activeMatch.kind === 'group') {
      const members = this.state.activeMatch.groupMembers ?? [];
      const isMember = members.some((member) => member.userId === userId);
      if (!isMember) return null;
      const isCandidate = members.length >= 3 && members[members.length - 1]?.userId === userId;
      return {
        ...this.state.activeMatch,
        groupRole: isCandidate ? 'group_candidate' : 'group_core',
      };
    }

    // activeMatch의 상대가 이 유저의 ACTIVE 요청과 연결되는지 확인
    const hasActiveRequest = this.state.requests.some(
      (r) => r.status === 'ACTIVE' && (r.fromUserId === userId || doesRequestTargetUser(r, userId)),
    );
    if (!hasActiveRequest) return null;

    return this.state.activeMatch;
  }

  getState(userId: string): MatchingResult {
    this.expireStaleRequests();
    this.autoApproveStaleCancelRequests();
    return {
      requests: this.getRequests(userId),
      activeMatch: this.getActiveMatch(userId),
    };
  }

  // --- Mutations ---

  sendRequest(fromId: string, toId: string, message: string | null): MatchingResult {
    const senderActive = this.getActiveMatch(fromId);
    if (senderActive?.kind === 'group' && senderActive.groupRole === 'group_core') {
      return this.getState(fromId);
    }
    if (senderActive && senderActive.kind !== 'group') {
      return this.getState(fromId);
    }

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
      r.id === requestId
        ? { ...r, status: 'CANCELLED' as const, resolvedAt: now, resolvedBy: userId }
        : r,
    );
    this.save();
    return this.getState(userId);
  }

  acceptRequest(requestId: string, userId: string): MatchingResult {
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request || request.status !== 'PENDING') return this.getState(userId);

    const now = new Date().toISOString();

    if (
      this.state.activeMatch?.kind === 'group' &&
      this.state.activeMatch.groupStage === 'PAIR_OPEN'
    ) {
      const coreIds = this.state.activeMatch.groupMembers?.map((member) => member.userId) ?? [];
      const approvals = Array.from(new Set([...(request.approvalUserIds ?? []), userId]));
      const allApproved = coreIds.length > 0 && approvals.length >= coreIds.length;

      this.state.requests = this.state.requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              requestKind: 'GROUP_CONV_JOIN',
              groupTargetUserIds: coreIds,
              approvalUserIds: allApproved ? [] : approvals,
              status: allApproved ? ('IN_CONVERSATION' as const) : r.status,
              acceptedAt: allApproved ? now : r.acceptedAt,
            }
          : r,
      );

      if (allApproved && this.state.activeMatch) {
        this.state.activeMatch = {
          ...this.state.activeMatch,
          groupStage: 'GROUP_FORMING',
          groupMemberCount: 3,
          groupMembers: [
            ...(this.state.activeMatch.groupMembers ?? []),
            { userId: request.fromUserId, nickname: request.fromUserId },
          ],
        };
      }
      this.save();
      return this.getState(userId);
    }

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
        ? {
            ...r,
            status: 'REJECTED' as const,
            rejectedAt: now,
            resolvedAt: now,
            resolvedBy: userId,
          }
        : r,
    );
    this.save();
    return this.getState(userId);
  }

  confirmMatch(
    requestId: string,
    userId: string,
    context: {
      currentUser: Pick<UserProfile, 'id' | 'nickname' | 'dormitoryId'>;
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
    const dormitoryId = partnerProfile?.dormitoryId ?? context.currentUser.dormitoryId ?? null;
    const groupSize = dormitoryId ? getMatchGroupSize(dormitoryId) : 2;

    const approvals = Array.from(new Set([...(request.approvalUserIds ?? []), userId]));
    const approvalTotal =
      this.state.activeMatch?.kind === 'group' &&
      this.state.activeMatch.groupStage === 'GROUP_FORMING'
        ? (this.state.activeMatch.groupMemberCount ?? 3)
        : 2;
    const allApproved = approvals.length >= approvalTotal;

    if (!allApproved) {
      this.state.requests = this.state.requests.map((r) =>
        r.id === requestId ? { ...r, approvalUserIds: approvals } : r,
      );
      this.save();
      return this.getState(userId);
    }

    if (
      this.state.activeMatch?.kind === 'group' &&
      this.state.activeMatch.groupStage === 'GROUP_FORMING'
    ) {
      this.state.activeMatch = {
        ...this.state.activeMatch,
        groupStage: 'GROUP_FINAL',
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelApprovalUserIds: [],
        cancelRequestKind: null,
      };
    } else {
      this.state.activeMatch = {
        matchId: `match-${++idCounter}`,
        partnerUserId: partnerId,
        partnerNickname: partnerProfile?.nickname ?? partnerId,
        partnerDormitoryId: dormitoryId,
        matchScore: scoreResult.score ?? 0,
        scoreType: scoreResult.type,
        matchedAt: now,
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelApprovalUserIds: [],
        cancelRequestKind: null,
        kind: groupSize === 3 ? 'group' : 'pair',
        groupRole: groupSize === 3 ? 'group_core' : null,
        groupStage: groupSize === 3 ? 'PAIR_OPEN' : null,
        groupCapacity: groupSize === 3 ? 3 : 2,
        groupMemberCount: groupSize === 3 ? 2 : 2,
        groupMembers:
          groupSize === 3
            ? [
                { userId: context.currentUser.id, nickname: context.currentUser.nickname },
                { userId: partnerId, nickname: partnerProfile?.nickname ?? partnerId },
              ]
            : undefined,
      };
    }

    this.state.requests = this.state.requests.map((r) => {
      if (r.id === requestId)
        return { ...r, status: 'ACTIVE' as const, approvalUserIds: approvals };
      // PAIR_OPEN 진입 시 자동 정리: A-B 양측 미결 요청 전부 취소 (GROUP_CONV_JOIN 변환 없음)
      if (r.status === 'PENDING' && !isRequestExpired(r))
        return {
          ...r,
          status: 'CANCELLED' as const,
          resolvedAt: now,
          resolvedBy: context.currentUser.id,
        };
      if (r.status === 'IN_CONVERSATION' && r.id !== requestId)
        return {
          ...r,
          status: 'CONVERSATION_ENDED' as const,
          resolvedAt: now,
          resolvedBy: context.currentUser.id,
        };
      return r;
    });

    this.save();
    return this.getState(userId);
  }

  seedGroupFinalScenario(
    coreA: GroupScenarioUser,
    coreB: GroupScenarioUser,
    candidate: GroupScenarioUser,
  ): MatchingResult {
    const dormitoryId =
      coreA.dormitoryId && getMatchGroupSize(coreA.dormitoryId) === 3
        ? coreA.dormitoryId
        : 'toegye';
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + MATCH_POLICY.REQUEST_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    this.state = {
      activeMatch: {
        matchId: `group-final-${++idCounter}`,
        partnerUserId: coreB.id,
        partnerNickname: coreB.nickname,
        partnerDormitoryId: dormitoryId,
        matchScore: 82,
        scoreType: 'full',
        matchedAt: now,
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelApprovalUserIds: [],
        cancelRequestKind: null,
        kind: 'group',
        groupRole: 'group_core',
        groupStage: 'GROUP_FINAL',
        groupCapacity: 3,
        groupMemberCount: 3,
        groupMembers: [
          { userId: coreA.id, nickname: coreA.nickname },
          { userId: coreB.id, nickname: coreB.nickname },
          { userId: candidate.id, nickname: candidate.nickname },
        ],
      },
      requests: [
        {
          id: `group-final-request-${++idCounter}`,
          fromUserId: candidate.id,
          toUserId: coreA.id,
          groupTargetUserIds: [coreA.id, coreB.id],
          requestKind: 'GROUP_CONV_JOIN',
          approvalUserIds: [coreA.id, coreB.id, candidate.id],
          status: 'ACTIVE',
          message: '3인 그룹 확정',
          createdAt: now,
          expiresAt,
          rejectedAt: null,
          acceptedAt: now,
          resolvedAt: null,
        },
      ],
    };
    this.save();
    return this.getState(coreA.id);
  }

  finalizePairGroup(userId: string): MatchingResult {
    if (!this.state.activeMatch) return this.getState(userId);
    if (
      this.state.activeMatch.kind !== 'group' ||
      this.state.activeMatch.groupStage !== 'PAIR_OPEN'
    ) {
      return this.getState(userId);
    }

    const now = new Date().toISOString();
    this.state.activeMatch = {
      ...this.state.activeMatch,
      groupStage: 'PAIR_FINAL',
    };

    this.state.requests = this.state.requests.map((r) => {
      if (r.status === 'PENDING' && !isRequestExpired(r) && r.fromUserId !== userId) {
        return {
          ...r,
          status: 'CANCELLED' as const,
          resolvedAt: now,
          resolvedBy: userId,
        };
      }
      return r;
    });

    this.save();
    return this.getState(userId);
  }

  /** PAIR_OPEN: A-B 코어 시점 + C의 합류 요청 PENDING */
  seedPairOpenScenario(user: GroupScenarioUser): MatchingResult {
    const dormitoryId =
      user.dormitoryId && getMatchGroupSize(user.dormitoryId) === 3
        ? user.dormitoryId
        : user.gender === 'F'
          ? 'nanji'
          : 'toegye';
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + MATCH_POLICY.REQUEST_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const coreB = { id: `${dormitoryId}-core-b`, nickname: '파트너B' };
    const candidateC = { id: `${dormitoryId}-candidate-c`, nickname: '합류희망C' };
    const candidateD = { id: `${dormitoryId}-candidate-d`, nickname: '합류희망D' };
    const candidateE = { id: `${dormitoryId}-candidate-e`, nickname: '합류희망E' };
    const groupTargetIds = [user.id, coreB.id];

    this.state = {
      activeMatch: {
        matchId: `pair-open-${++idCounter}`,
        partnerUserId: coreB.id,
        partnerNickname: coreB.nickname,
        partnerDormitoryId: dormitoryId,
        matchScore: 78,
        scoreType: 'full',
        matchedAt: now,
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelApprovalUserIds: [],
        cancelRequestKind: null,
        kind: 'group',
        groupRole: 'group_core',
        groupStage: 'PAIR_OPEN',
        groupCapacity: 3,
        groupMemberCount: 2,
        groupMembers: [
          { userId: user.id, nickname: user.nickname },
          { userId: coreB.id, nickname: coreB.nickname },
        ],
      },
      requests: [
        {
          id: `pair-open-req-c-${++idCounter}`,
          fromUserId: candidateC.id,
          toUserId: user.id,
          groupTargetUserIds: groupTargetIds,
          requestKind: 'GROUP_CONV_JOIN',
          approvalUserIds: [],
          status: 'PENDING',
          message: '3인실 같이 쓰고 싶습니다!',
          createdAt: now,
          expiresAt,
          rejectedAt: null,
          acceptedAt: null,
          resolvedAt: null,
        },
        {
          id: `pair-open-req-d-${++idCounter}`,
          fromUserId: candidateD.id,
          toUserId: user.id,
          groupTargetUserIds: groupTargetIds,
          requestKind: 'GROUP_CONV_JOIN',
          approvalUserIds: [user.id],
          status: 'PENDING',
          message: '저도 3인실 합류 희망합니다',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt,
          rejectedAt: null,
          acceptedAt: null,
          resolvedAt: null,
        },
        {
          id: `pair-open-req-e-${++idCounter}`,
          fromUserId: candidateE.id,
          toUserId: user.id,
          groupTargetUserIds: groupTargetIds,
          requestKind: 'GROUP_CONV_JOIN',
          approvalUserIds: [],
          status: 'PENDING',
          message: '깔끔한 성격입니다. 합류할게요',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt,
          rejectedAt: null,
          acceptedAt: null,
          resolvedAt: null,
        },
      ],
    };
    this.save();
    return this.getState(user.id);
  }

  /** GROUP_FORMING: A-B-C 3인 대화 중 (코어 A 시점) */
  seedGroupFormingScenario(user: GroupScenarioUser): MatchingResult {
    const dormitoryId =
      user.dormitoryId && getMatchGroupSize(user.dormitoryId) === 3
        ? user.dormitoryId
        : user.gender === 'F'
          ? 'nanji'
          : 'toegye';
    const now = new Date().toISOString();
    const acceptedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(
      new Date(acceptedAt).getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const coreB = { id: `${dormitoryId}-core-b`, nickname: '파트너B' };
    const candidateC = { id: `${dormitoryId}-candidate-c`, nickname: '합류멤버C' };

    this.state = {
      activeMatch: {
        matchId: `group-forming-${++idCounter}`,
        partnerUserId: coreB.id,
        partnerNickname: coreB.nickname,
        partnerDormitoryId: dormitoryId,
        matchScore: 75,
        scoreType: 'full',
        matchedAt: now,
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelApprovalUserIds: [],
        cancelRequestKind: null,
        kind: 'group',
        groupRole: 'group_core',
        groupStage: 'GROUP_FORMING',
        groupCapacity: 3,
        groupMemberCount: 3,
        groupMembers: [
          { userId: user.id, nickname: user.nickname },
          { userId: coreB.id, nickname: coreB.nickname },
          { userId: candidateC.id, nickname: candidateC.nickname },
        ],
      },
      requests: [
        {
          id: `group-forming-req-${++idCounter}`,
          fromUserId: candidateC.id,
          toUserId: user.id,
          groupTargetUserIds: [user.id, coreB.id],
          requestKind: 'GROUP_CONV_JOIN',
          approvalUserIds: [user.id, coreB.id],
          status: 'IN_CONVERSATION',
          message: '3인실 같이 쓰고 싶습니다!',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt,
          rejectedAt: null,
          acceptedAt,
          resolvedAt: null,
        },
      ],
    };
    this.save();
    return this.getState(user.id);
  }

  /** C 시점: 개인이 그룹에 합류 요청 보낸 상태 */
  seedGroupCandidateScenario(user: GroupScenarioUser): MatchingResult {
    const dormitoryId =
      user.dormitoryId && getMatchGroupSize(user.dormitoryId) === 3
        ? user.dormitoryId
        : user.gender === 'F'
          ? 'nanji'
          : 'toegye';
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + MATCH_POLICY.REQUEST_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const coreA = { id: `${dormitoryId}-core-a`, nickname: '그룹A' };
    const coreB = { id: `${dormitoryId}-core-b`, nickname: '그룹B' };

    this.state = {
      activeMatch: null,
      requests: [
        {
          id: `group-join-${++idCounter}`,
          fromUserId: user.id,
          toUserId: coreA.id,
          groupTargetUserIds: [coreA.id, coreB.id],
          requestKind: 'GROUP_CONV_JOIN',
          approvalUserIds: [],
          status: 'PENDING',
          message: '3인실 그룹에 합류하고 싶어요',
          createdAt: now,
          expiresAt,
          rejectedAt: null,
          acceptedAt: null,
          resolvedAt: null,
        },
      ],
    };
    this.save();
    return this.getState(user.id);
  }

  revokeConfirmMatch(requestId: string, userId: string): MatchingResult {
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request || request.status !== 'IN_CONVERSATION') return this.getState(userId);

    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            approvalUserIds: (r.approvalUserIds ?? []).filter(
              (approvalId) => approvalId !== userId,
            ),
          }
        : r,
    );
    this.save();
    return this.getState(userId);
  }

  setConfirmState(userId: string, mode: 'none' | 'self' | 'others' | 'all'): MatchingResult {
    const request = this.state.requests.find(
      (r) =>
        r.status === 'IN_CONVERSATION' &&
        (r.fromUserId === userId || doesRequestTargetUser(r, userId)),
    );
    if (!request) return this.getState(userId);

    const participantIds =
      this.state.activeMatch?.kind === 'group' &&
      this.state.activeMatch.groupStage === 'GROUP_FORMING'
        ? (this.state.activeMatch.groupMembers?.map((member) => member.userId) ?? [userId])
        : [userId, request.fromUserId === userId ? request.toUserId : request.fromUserId];

    const uniqueParticipants = Array.from(new Set(participantIds.filter(Boolean)));
    const others = uniqueParticipants.filter((participantId) => participantId !== userId);
    const nextApprovals =
      mode === 'none'
        ? []
        : mode === 'self'
          ? [userId]
          : mode === 'others'
            ? others
            : uniqueParticipants;

    this.state.requests = this.state.requests.map((r) =>
      r.id === request.id ? { ...r, approvalUserIds: nextApprovals } : r,
    );
    this.save();
    return this.getState(userId);
  }

  endConversation(requestId: string, userId: string): MatchingResult {
    const now = new Date().toISOString();
    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'CONVERSATION_ENDED' as const,
            resolvedAt: now,
            resolvedBy: userId,
          }
        : r,
    );
    this.save();
    return this.getState(userId);
  }

  endMatch(userId: string): MatchingResult {
    if (!this.state.activeMatch) return this.getState(userId);

    const now = new Date().toISOString();
    const members = this.state.activeMatch.groupMembers ?? [];
    const coreIds = members.slice(0, 2).map((member) => member.userId);
    // GROUP_FINAL: 전원 동등 Member. 아무나 이탈 가능, 나머지 1명 동의
    const isGroupFinalMemberLeave =
      this.state.activeMatch.kind === 'group' &&
      this.state.activeMatch.groupStage === 'GROUP_FINAL';
    // GROUP_FORMING: 코어(A-B) 그룹 해체. 상대 동의 필요
    const isGroupCoreCancel =
      this.state.activeMatch.kind === 'group' &&
      coreIds.includes(userId) &&
      this.state.activeMatch.cancelRequestKind !== 'MEMBER_LEAVE' &&
      this.state.activeMatch.groupStage === 'GROUP_FORMING';

    if (isGroupFinalMemberLeave) {
      // 이탈 요청 시작
      if (!this.state.activeMatch.cancelRequestedAt) {
        this.state.activeMatch = {
          ...this.state.activeMatch,
          cancelRequestedAt: now,
          cancelRequestedBy: userId,
          cancelApprovalUserIds: [],
          cancelRequestKind: 'MEMBER_LEAVE',
        };
        this.save();
        return this.getState(userId);
      }

      // 요청자 본인 → 철회
      if (this.state.activeMatch.cancelRequestedBy === userId) {
        this.state.activeMatch = {
          ...this.state.activeMatch,
          cancelRequestedAt: null,
          cancelRequestedBy: null,
          cancelApprovalUserIds: [],
          cancelRequestKind: null,
        };
        this.save();
        return this.getState(userId);
      }

      // 나머지 멤버 → 승인 (1명이면 즉시 적용)
      const leaverId = this.state.activeMatch.cancelRequestedBy;
      const remainingMembers = members.filter((m) => m.userId !== leaverId);
      const remainingMemberIds = remainingMembers.map((m) => m.userId);

      if (remainingMemberIds.includes(userId)) {
        const approvals = Array.from(
          new Set([...(this.state.activeMatch.cancelApprovalUserIds ?? []), userId]),
        );
        if (approvals.length >= 1) {
          this.state.requests = this.state.requests.map((r) =>
            r.status === 'ACTIVE'
              ? {
                  ...r,
                  status: 'UNMATCHED' as const,
                  resolvedAt: now,
                  resolvedBy: leaverId ?? userId,
                }
              : r,
          );
          // 나머지 2명 → PAIR_OPEN
          this.state.activeMatch = {
            ...this.state.activeMatch,
            partnerUserId: remainingMembers[1]?.userId ?? this.state.activeMatch.partnerUserId,
            partnerNickname:
              remainingMembers[1]?.nickname ?? this.state.activeMatch.partnerNickname,
            groupRole: 'group_core',
            groupStage: 'PAIR_OPEN',
            groupMemberCount: 2,
            groupMembers: remainingMembers.slice(0, 2),
            cancelRequestedAt: null,
            cancelRequestedBy: null,
            cancelApprovalUserIds: [],
            cancelRequestKind: null,
          };
          this.save();
          return this.getState(userId);
        }

        this.state.activeMatch = {
          ...this.state.activeMatch,
          cancelApprovalUserIds: approvals,
        };
        this.save();
        return this.getState(userId);
      }

      return this.getState(userId);
    }

    if (isGroupCoreCancel) {
      const memberIds = members.map((member) => member.userId);
      const otherMemberIds = memberIds.filter((memberId) => memberId !== userId);

      if (!this.state.activeMatch.cancelRequestedAt) {
        this.state.activeMatch = {
          ...this.state.activeMatch,
          cancelRequestedAt: now,
          cancelRequestedBy: userId,
          cancelApprovalUserIds: [],
          cancelRequestKind: 'MATCH_CANCEL',
        };
        this.save();
        return this.getState(userId);
      }

      if (this.state.activeMatch.cancelRequestedBy === userId) {
        this.state.activeMatch = {
          ...this.state.activeMatch,
          cancelRequestedAt: null,
          cancelRequestedBy: null,
          cancelApprovalUserIds: [],
          cancelRequestKind: null,
        };
        this.save();
        return this.getState(userId);
      }

      if (otherMemberIds.includes(userId)) {
        const approvals = Array.from(
          new Set([...(this.state.activeMatch.cancelApprovalUserIds ?? []), userId]),
        );
        if (approvals.length >= otherMemberIds.length) {
          this.state.requests = this.state.requests.map((r) =>
            r.status === 'ACTIVE' || r.status === 'IN_CONVERSATION'
              ? {
                  ...r,
                  status: 'UNMATCHED' as const,
                  resolvedAt: now,
                  resolvedBy: this.state.activeMatch?.cancelRequestedBy ?? userId,
                }
              : r,
          );
          this.state.activeMatch = null;
          this.save();
          return this.getState(userId);
        }

        this.state.activeMatch = {
          ...this.state.activeMatch,
          cancelApprovalUserIds: approvals,
        };
        this.save();
        return this.getState(userId);
      }
    }

    if (!this.state.activeMatch.cancelRequestedAt) {
      this.state.activeMatch = {
        ...this.state.activeMatch,
        cancelRequestedAt: now,
        cancelRequestedBy: userId,
        cancelApprovalUserIds: [],
        cancelRequestKind: 'MATCH_CANCEL',
      };
      this.save();
      return this.getState(userId);
    }

    if (this.state.activeMatch.cancelRequestedBy === userId) {
      this.state.activeMatch = {
        ...this.state.activeMatch,
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelApprovalUserIds: [],
        cancelRequestKind: null,
      };
      this.save();
      return this.getState(userId);
    }

    this.state.activeMatch = {
      ...this.state.activeMatch,
      cancelApprovalUserIds: Array.from(
        new Set([...(this.state.activeMatch.cancelApprovalUserIds ?? []), userId]),
      ),
    };
    this.state.requests = this.state.requests.map((r) =>
      r.status === 'ACTIVE'
        ? {
            ...r,
            status: 'UNMATCHED' as const,
            resolvedAt: now,
            resolvedBy: this.state.activeMatch?.cancelRequestedBy ?? userId,
          }
        : r,
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
