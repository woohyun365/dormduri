import { getDormitoryById } from '@/constants/dormitory';
import type { ActiveMatch, MatchRequest, MatchStatus } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';
import { calcMatchScoreWithGating, type MatchScoreType } from '@/utils/matchScore';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type ChatRoomState = 'active' | 'conversation' | 'archived';
export type ChatRoomKind = 'pair';
export type MatchCancelState = 'idle' | 'requested_by_me' | 'requested_by_other';

export interface ChatTimelineEntry {
  id: string;
  kind: 'message' | 'system';
  text: string;
  timestamp: string;
  isMine?: boolean;
}

export interface ChatRoomSummary {
  roomKey: string;
  requestId: string | null;
  partnerUserId: string | null;
  title: string;
  memberNames: string[];
  memberCount: number;
  roomKind: ChatRoomKind;
  chatState: ChatRoomState;
  sourceStatus: MatchStatus | 'ACTIVE_MATCH';
  statusLabel: string;
  contextLine: string;
  previewText: string;
  lastActivityAt: string | null;
  expiresAt: string | null;
  expiresSoonText: string | null;
  readOnly: boolean;
  matchScore: number | null;
  scoreType: MatchScoreType | null;
  profile: RoommateProfile | null;
  timeline: ChatTimelineEntry[];
  selfConfirmed: boolean;
  cancelState: MatchCancelState;
  canOpenProfile: boolean;
  canConfirmInChat: boolean;
  canEndConversationInChat: boolean;
  canManageMatchInChat: boolean;
  canBlock: boolean;
  canReport: boolean;
}

interface DeriveChatRoomsParams {
  currentUser: UserProfile;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  blockedUserIds?: Set<string>;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function formatClock(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatMonthDay(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function isSameDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function formatChatListTime(value: string | null): string {
  const ts = parseTime(value);
  if (ts === null) return '';

  const now = Date.now();
  const diff = now - ts;

  if (diff < MINUTE_MS) return '방금';
  if (diff < HOUR_MS) return `${Math.max(1, Math.floor(diff / MINUTE_MS))}분 전`;
  if (isSameDay(now, ts)) return formatClock(ts);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday.getTime() - DAY_MS;
  if (ts >= startOfYesterday && ts < startOfToday.getTime()) return '어제';

  return formatMonthDay(ts);
}

export function formatChatMessageTime(value: string): string {
  return formatClock(value);
}

export function formatChatDateDivider(value: string): string {
  const ts = parseTime(value);
  if (ts === null) return '';

  const now = Date.now();
  if (isSameDay(now, ts)) return '오늘';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday.getTime() - DAY_MS;
  if (ts >= startOfYesterday && ts < startOfToday.getTime()) return '어제';

  return formatMonthDay(ts);
}

function buildPairProfile(
  currentUser: UserProfile,
  rawProfile: Omit<RoommateProfile, 'matchScore'> | undefined,
): {
  profile: RoommateProfile | null;
  matchScore: number | null;
  scoreType: MatchScoreType | null;
} {
  if (!rawProfile) {
    return { profile: null, matchScore: null, scoreType: null };
  }

  const scoreResult = calcMatchScoreWithGating(currentUser.lifestyle, rawProfile.lifestyle);
  return {
    profile: {
      ...rawProfile,
      matchScore: scoreResult.score ?? 0,
    },
    matchScore: scoreResult.score,
    scoreType: scoreResult.type,
  };
}

function buildRoomKey(participantId: string): string {
  return `pair:${participantId}`;
}

function getRequestParticipantId(request: MatchRequest, currentUserId: string): string | null {
  if (request.fromUserId === currentUserId) return request.toUserId;
  if (request.toUserId === currentUserId) return request.fromUserId;
  return null;
}

function getDormitoryContext(dormitoryId: string | null | undefined): string | null {
  if (!dormitoryId) return null;
  const dormitory = getDormitoryById(dormitoryId);
  if (!dormitory) return null;
  return `${dormitory.name} · ${dormitory.roomType}인실`;
}

function computeConversationExpiresAt(acceptedAt: string | null): string | null {
  const acceptedTs = parseTime(acceptedAt);
  if (acceptedTs === null) return null;
  return new Date(acceptedTs + 7 * DAY_MS).toISOString();
}

function getExpirationBadge(expiresAt: string | null): string | null {
  const expiresTs = parseTime(expiresAt);
  if (expiresTs === null) return null;
  const diff = expiresTs - Date.now();
  if (diff <= 0 || diff > DAY_MS) return null;
  const hoursLeft = Math.ceil(diff / HOUR_MS);
  if (hoursLeft <= 1) return '곧 종료';
  return `${hoursLeft}시간 뒤 종료`;
}

function buildSystemEntry(id: string, text: string, timestamp: string): ChatTimelineEntry {
  return { id, kind: 'system', text, timestamp };
}

function buildTimelineForRequest(
  request: MatchRequest,
  roomKey: string,
  chatState: ChatRoomState,
  currentUserId: string,
  matchedAt?: string | null,
): ChatTimelineEntry[] {
  const items: ChatTimelineEntry[] = [];

  if (request.message) {
    items.push({
      id: `${roomKey}:intro`,
      kind: 'message',
      text: request.message,
      timestamp: request.createdAt,
      isMine: request.fromUserId === currentUserId,
    });
  }

  if (chatState === 'conversation') {
    items.push(
      buildSystemEntry(
        `${roomKey}:conversation-start`,
        '대화가 시작되었어요. 탐색 대화는 수락 후 7일 동안 유지됩니다.',
        request.acceptedAt ?? request.createdAt,
      ),
    );
  }

  if (chatState === 'active') {
    items.push(
      buildSystemEntry(
        `${roomKey}:match-confirmed`,
        '매칭이 확정되었어요. 시즌 종료 전까지 이 대화를 계속 확인할 수 있어요.',
        matchedAt ?? request.acceptedAt ?? request.createdAt,
      ),
    );
  }

  if (chatState === 'archived') {
    items.push(
      buildSystemEntry(
        `${roomKey}:archived`,
        request.status === 'UNMATCHED'
          ? '매칭이 해제되어 이 대화는 읽기 전용으로 전환되었어요.'
          : '대화가 종료되어 이 대화는 읽기 전용으로 전환되었어요.',
        request.resolvedAt ?? request.acceptedAt ?? request.createdAt,
      ),
    );
  }

  if (items.length === 0) {
    items.push(
      buildSystemEntry(
        `${roomKey}:empty`,
        '표시할 메시지가 아직 없어요.',
        matchedAt ?? request.createdAt,
      ),
    );
  }

  return items.sort((a, b) => (parseTime(a.timestamp) ?? 0) - (parseTime(b.timestamp) ?? 0));
}

function buildTimelineForActiveMatch(
  roomKey: string,
  matchedAt: string,
  request?: MatchRequest,
  currentUserId?: string,
): ChatTimelineEntry[] {
  if (request && currentUserId) {
    return buildTimelineForRequest(request, roomKey, 'active', currentUserId, matchedAt);
  }

  return [
    buildSystemEntry(
      `${roomKey}:match-confirmed`,
      '매칭이 확정되었어요. 시즌 종료 전까지 이 대화를 계속 확인할 수 있어요.',
      matchedAt,
    ),
  ];
}

function buildContextLine({
  score,
  scoreType,
  dormitoryLabel,
  stateLabel,
}: {
  score: number | null;
  scoreType: MatchScoreType | null;
  dormitoryLabel: string | null;
  stateLabel: string;
}): string {
  const parts: string[] = [];
  if (scoreType === 'gated') parts.push('매칭도 잠금');
  else if (score !== null) parts.push(`매칭도 ${score}%`);
  if (dormitoryLabel) parts.push(dormitoryLabel);
  parts.push(stateLabel);
  return parts.join(' · ');
}

function compareByRecent(a: ChatRoomSummary, b: ChatRoomSummary): number {
  return (parseTime(b.lastActivityAt) ?? 0) - (parseTime(a.lastActivityAt) ?? 0);
}

function getPriority(state: ChatRoomState): number {
  switch (state) {
    case 'active':
      return 3;
    case 'conversation':
      return 2;
    case 'archived':
      return 1;
    default:
      return 0;
  }
}

function upsertRoom(map: Map<string, ChatRoomSummary>, room: ChatRoomSummary) {
  const current = map.get(room.roomKey);
  if (!current) {
    map.set(room.roomKey, room);
    return;
  }

  const nextPriority = getPriority(room.chatState);
  const currentPriority = getPriority(current.chatState);
  if (nextPriority > currentPriority) {
    map.set(room.roomKey, room);
    return;
  }

  if (nextPriority === currentPriority && compareByRecent(room, current) < 0) {
    map.set(room.roomKey, room);
  }
}

function isBlockedPair(partnerUserId: string | null, blockedUserIds?: Set<string>): boolean {
  if (!partnerUserId || !blockedUserIds) return false;
  return blockedUserIds.has(partnerUserId);
}

function findPairActiveRequest(
  matchRequests: MatchRequest[],
  currentUserId: string,
  partnerUserId: string,
): MatchRequest | undefined {
  return matchRequests.find(
    (request) =>
      request.status === 'ACTIVE' &&
      ((request.fromUserId === currentUserId && request.toUserId === partnerUserId) ||
        (request.fromUserId === partnerUserId && request.toUserId === currentUserId)),
  );
}

export function deriveChatRooms({
  currentUser,
  profiles,
  matchRequests,
  activeMatch,
  blockedUserIds,
}: DeriveChatRoomsParams): ChatRoomSummary[] {
  const rooms = new Map<string, ChatRoomSummary>();
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  if (activeMatch) {
    const partnerUserId = activeMatch.partnerUserId;
    const roomKey = buildRoomKey(partnerUserId);

    if (!isBlockedPair(partnerUserId, blockedUserIds)) {
      const pairProfile = profileMap.get(partnerUserId);
      const pairScore = pairProfile
        ? buildPairProfile(currentUser, pairProfile)
        : {
            profile: null,
            matchScore: activeMatch.matchScore ?? null,
            scoreType: activeMatch.scoreType,
          };
      const activeRequest = findPairActiveRequest(matchRequests, currentUser.id, partnerUserId);
      const dormitoryLabel = getDormitoryContext(
        pairProfile?.dormitoryId ?? activeMatch.partnerDormitoryId ?? currentUser.dormitoryId,
      );
      const timeline = buildTimelineForActiveMatch(
        roomKey,
        activeMatch.matchedAt,
        activeRequest,
        currentUser.id,
      );
      const lastActivityAt =
        activeRequest?.acceptedAt ?? activeRequest?.createdAt ?? activeMatch.matchedAt;

      upsertRoom(rooms, {
        roomKey,
        requestId: activeRequest?.id ?? null,
        partnerUserId,
        title: activeMatch.partnerNickname,
        memberNames: [activeMatch.partnerNickname],
        memberCount: 2,
        roomKind: 'pair',
        chatState: 'active',
        sourceStatus: 'ACTIVE_MATCH',
        statusLabel: activeMatch.cancelRequestedAt ? '해제 진행 중' : '매칭 확정',
        contextLine: buildContextLine({
          score: pairScore.matchScore ?? activeMatch.matchScore ?? null,
          scoreType: pairScore.scoreType ?? activeMatch.scoreType,
          dormitoryLabel,
          stateLabel: activeMatch.cancelRequestedAt ? '해제 진행 중' : '매칭 확정',
        }),
        previewText:
          activeRequest?.message ??
          '호실 선택과 생활 조율에 필요한 내용을 이 대화에서 계속 확인할 수 있어요.',
        lastActivityAt,
        expiresAt: null,
        expiresSoonText: null,
        readOnly: false,
        matchScore: pairScore.matchScore ?? activeMatch.matchScore ?? null,
        scoreType: pairScore.scoreType ?? activeMatch.scoreType,
        profile: pairScore.profile,
        timeline,
        selfConfirmed: false,
        cancelState: activeMatch.cancelRequestedAt
          ? activeMatch.cancelRequestedBy === currentUser.id
            ? 'requested_by_me'
            : 'requested_by_other'
          : 'idle',
        canOpenProfile: pairScore.profile != null,
        canConfirmInChat: false,
        canEndConversationInChat: false,
        canManageMatchInChat: true,
        canBlock: false,
        canReport: true,
      });
    }
  }

  for (const request of matchRequests) {
    if (
      !['IN_CONVERSATION', 'CONVERSATION_ENDED', 'UNMATCHED', 'ACTIVE'].includes(request.status)
    ) {
      continue;
    }

    const partnerUserId = getRequestParticipantId(request, currentUser.id);
    if (partnerUserId === null) continue;

    const roomKey = buildRoomKey(partnerUserId);
    if (isBlockedPair(partnerUserId, blockedUserIds)) continue;

    if (request.status === 'ACTIVE' && rooms.has(roomKey)) continue;

    const pairProfile = profileMap.get(partnerUserId);
    const pairScore = buildPairProfile(currentUser, pairProfile);
    const dormitoryLabel = getDormitoryContext(pairProfile?.dormitoryId ?? currentUser.dormitoryId);
    const chatState: ChatRoomState =
      request.status === 'IN_CONVERSATION'
        ? 'conversation'
        : request.status === 'ACTIVE'
          ? 'active'
          : 'archived';
    const expiresAt =
      chatState === 'conversation' ? computeConversationExpiresAt(request.acceptedAt) : null;
    const statusLabel =
      request.status === 'IN_CONVERSATION'
        ? '대화 중'
        : request.status === 'UNMATCHED'
          ? '매칭 해제'
          : request.status === 'ACTIVE'
            ? '매칭 확정'
            : '대화 종료';
    const timeline = buildTimelineForRequest(request, roomKey, chatState, currentUser.id);

    upsertRoom(rooms, {
      roomKey,
      requestId: request.id,
      partnerUserId,
      title: pairProfile?.nickname ?? partnerUserId,
      memberNames: [pairProfile?.nickname ?? partnerUserId],
      memberCount: 2,
      roomKind: 'pair',
      chatState,
      sourceStatus: request.status,
      statusLabel,
      contextLine: buildContextLine({
        score: pairScore.matchScore,
        scoreType: pairScore.scoreType,
        dormitoryLabel,
        stateLabel: statusLabel,
      }),
      previewText:
        request.message ??
        (chatState === 'archived' ? '종료된 대화를 다시 읽을 수 있어요.' : '대화를 시작해 보세요.'),
      lastActivityAt: request.resolvedAt ?? request.acceptedAt ?? request.createdAt,
      expiresAt,
      expiresSoonText: getExpirationBadge(expiresAt),
      readOnly: chatState === 'archived',
      matchScore: pairScore.matchScore,
      scoreType: pairScore.scoreType,
      profile: pairScore.profile,
      timeline,
      selfConfirmed: false,
      cancelState: 'idle',
      canOpenProfile: pairScore.profile != null,
      canConfirmInChat: request.status === 'IN_CONVERSATION',
      canEndConversationInChat: request.status === 'IN_CONVERSATION',
      canManageMatchInChat: false,
      canBlock: request.status !== 'ACTIVE',
      canReport: true,
    });
  }

  return [...rooms.values()].sort(compareByRecent);
}
