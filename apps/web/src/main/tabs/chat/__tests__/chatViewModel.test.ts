import { describe, expect, it } from 'vitest';
import { deriveChatRooms } from '../chatViewModel';
import type { ActiveMatch, MatchRequest } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

const baseLifestyle: UserProfile['lifestyle'] = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'E_CIG_OK',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'LOW_VOLUME_OK',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'SCREEN_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

const user: UserProfile = {
  id: 'me',
  nickname: '나',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: baseLifestyle,
  intro: '',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
};

const profiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: 'partner-1',
    nickname: '홍길동',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
  {
    id: 'partner-2',
    nickname: '임꺽정',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

describe('deriveChatRooms', () => {
  it('탐색 대화는 acceptedAt 기준 7일 TTL과 만료 임박 배지를 계산한다', () => {
    const acceptedAt = new Date(Date.now() - (6 * 24 + 2) * 60 * 60 * 1000).toISOString();
    const request: MatchRequest = {
      id: 'req-conv',
      fromUserId: 'partner-1',
      toUserId: 'me',
      status: 'IN_CONVERSATION',
      message: '생활 패턴이 비슷해 보여요',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      rejectedAt: null,
      acceptedAt,
      resolvedAt: null,
    };

    const [room] = deriveChatRooms({
      currentUser: user,
      profiles,
      matchRequests: [request],
      activeMatch: null,
      blockedUserIds: new Set(),
    });

    expect(room).toBeDefined();
    if (!room) throw new Error('room not derived');

    expect(room.chatState).toBe('conversation');
    expect(room.expiresAt).toBe(
      new Date(new Date(acceptedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(room.expiresSoonText).not.toBeNull();
    expect(room.canConfirmInChat).toBe(true);
    expect(room.timeline.some((entry) => entry.kind === 'system')).toBe(true);
  });

  it('매칭 확정 대화는 activeMatch를 우선하고 해제 진행 상태를 반영한다', () => {
    const activeRequest: MatchRequest = {
      id: 'req-active',
      fromUserId: 'me',
      toUserId: 'partner-1',
      status: 'ACTIVE',
      message: '호실 선택 전에 대화해요',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-05T00:00:00.000Z',
      rejectedAt: null,
      acceptedAt: '2026-03-02T00:00:00.000Z',
      resolvedAt: null,
      approvalUserIds: ['me'],
    };
    const activeMatch: ActiveMatch = {
      matchId: 'match-1',
      partnerUserId: 'partner-1',
      partnerNickname: '홍길동',
      partnerDormitoryId: 'dasan',
      matchScore: 84,
      scoreType: 'full',
      matchedAt: '2026-03-03T00:00:00.000Z',
      cancelRequestedAt: '2026-03-04T00:00:00.000Z',
      cancelRequestedBy: 'me',
    };

    const [room] = deriveChatRooms({
      currentUser: user,
      profiles,
      matchRequests: [activeRequest],
      activeMatch,
      blockedUserIds: new Set(),
    });

    expect(room).toBeDefined();
    if (!room) throw new Error('room not derived');

    expect(room.chatState).toBe('active');
    expect(room.statusLabel).toBe('해제 진행 중');
    expect(room.cancelState).toBe('requested_by_me');
    expect(room.canManageMatchInChat).toBe(true);
    expect(room.canBlock).toBe(false);
    expect(room.previewText).toContain('호실 선택');
  });

  it('차단된 상대의 대화방은 목록에서 제거한다', () => {
    const request: MatchRequest = {
      id: 'req-ended',
      fromUserId: 'partner-2',
      toUserId: 'me',
      status: 'CONVERSATION_ENDED',
      message: '안녕하세요',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-05T00:00:00.000Z',
      rejectedAt: null,
      acceptedAt: '2026-03-02T00:00:00.000Z',
      resolvedAt: '2026-03-06T00:00:00.000Z',
    };

    const rooms = deriveChatRooms({
      currentUser: user,
      profiles,
      matchRequests: [request],
      activeMatch: null,
      blockedUserIds: new Set(['partner-2']),
    });

    expect(rooms).toHaveLength(0);
  });
});
