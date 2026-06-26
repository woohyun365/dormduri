import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchingTab from '../MatchingTab';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import type { ActiveMatch, MatchRequest } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

const baseLifestyle = {
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
  earphoneExpectation: 'STUDY',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'SCREEN_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
} as UserProfile['lifestyle'];

const user: UserProfile = {
  id: 'user-1',
  nickname: '나',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'toegye',
  lifestyle: baseLifestyle,
  intro: '',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
};

const profiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: 'partner-1',
    nickname: '파트너',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
  {
    id: 'candidate-1',
    nickname: '후보',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
  {
    id: 'toegye-core-a',
    nickname: '그룹A',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
  {
    id: 'toegye-core-b',
    nickname: '그룹B',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

const activeMatch: ActiveMatch = {
  matchId: 'match-1',
  partnerUserId: 'partner-1',
  partnerNickname: '파트너',
  partnerDormitoryId: 'toegye',
  matchScore: 84,
  scoreType: 'full',
  matchedAt: '2099-01-01T00:00:00.000Z',
  cancelRequestedAt: null,
  cancelRequestedBy: null,
  kind: 'group',
  groupRole: 'group_core',
  groupStage: 'PAIR_OPEN',
  groupCapacity: 3,
  groupMemberCount: 2,
  groupMembers: [
    { userId: 'user-1', nickname: '나' },
    { userId: 'partner-1', nickname: '파트너' },
  ],
};

const requests: MatchRequest[] = [
  {
    id: 'req-1',
    fromUserId: 'candidate-1',
    toUserId: 'user-1',
    status: 'PENDING',
    message: '합류하고 싶어요',
    createdAt: '2099-01-01T00:00:00.000Z',
    expiresAt: '2099-01-06T00:00:00.000Z',
    rejectedAt: null,
    acceptedAt: null,
    resolvedAt: null,
  },
];

describe('MatchingTab 3인실 그룹 코어 UI', () => {
  it('2/3 그룹 카드와 합류 요청 관리 영역을 함께 보여준다', () => {
    render(
      <SeasonProvider
        value={{
          season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
          state: 'SEASON_MATCHING',
          isOpen: false,
          isMatching: true,
          daysUntilEnd: 14,
        }}
      >
        <MatchingTab
          user={user}
          matchRequests={requests}
          activeMatch={activeMatch}
          profiles={profiles}
          pastSeasons={[]}
          onCancelRequest={vi.fn()}
          onAcceptRequest={vi.fn()}
          onRejectRequest={vi.fn()}
          onConfirmMatch={vi.fn()}
          onRevokeConfirmMatch={vi.fn()}
          onFinalizePairGroup={vi.fn()}
          onEndConversation={vi.fn()}
          onEndMatch={vi.fn()}
          onNavigate={vi.fn()}
        />
      </SeasonProvider>,
    );

    expect(screen.getByText('3인실 매칭 안내')).toBeInTheDocument();
    expect(screen.getByText('그룹 합류 요청')).toBeInTheDocument();
    expect(screen.getByText('응답 필요')).toBeInTheDocument();
  });

  it('개인 C가 보낸 그룹 요청에서는 코어 승인 진행 상황이 노출되지 않는다', () => {
    const candidateUser: UserProfile = {
      ...user,
      id: 'candidate-1',
      nickname: '후보',
    };
    const candidateRequest: MatchRequest = {
      id: 'group-req-1',
      fromUserId: 'candidate-1',
      toUserId: 'toegye-core-a',
      groupTargetUserIds: ['toegye-core-a', 'toegye-core-b'],
      requestKind: 'GROUP_CONV_JOIN',
      approvalUserIds: ['toegye-core-a'],
      status: 'PENDING',
      message: '합류하고 싶어요',
      createdAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-01-06T00:00:00.000Z',
      rejectedAt: null,
      acceptedAt: null,
      resolvedAt: null,
    };

    render(
      <SeasonProvider
        value={{
          season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
          state: 'SEASON_MATCHING',
          isOpen: false,
          isMatching: true,
          daysUntilEnd: 14,
        }}
      >
        <MatchingTab
          user={candidateUser}
          matchRequests={[candidateRequest]}
          activeMatch={null}
          profiles={profiles}
          pastSeasons={[]}
          onCancelRequest={vi.fn()}
          onAcceptRequest={vi.fn()}
          onRejectRequest={vi.fn()}
          onConfirmMatch={vi.fn()}
          onRevokeConfirmMatch={vi.fn()}
          onFinalizePairGroup={vi.fn()}
          onEndConversation={vi.fn()}
          onEndMatch={vi.fn()}
          onNavigate={vi.fn()}
        />
      </SeasonProvider>,
    );

    expect(screen.getByText('그룹A & 그룹B')).toBeInTheDocument();
    // C 시점에서는 코어 승인 진행 상황 비공개 (정책)
    expect(screen.queryByText(/\/2 승인/)).not.toBeInTheDocument();
  });

  it('받은 요청 화면에서는 매칭도 우선 스위치로 정렬 방식을 바꿀 수 있다', async () => {
    const uiUser = userEvent.setup();

    render(
      <SeasonProvider
        value={{
          season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
          state: 'SEASON_MATCHING',
          isOpen: false,
          isMatching: true,
          daysUntilEnd: 14,
        }}
      >
        <MatchingTab
          user={user}
          matchRequests={requests}
          activeMatch={null}
          profiles={profiles}
          pastSeasons={[]}
          onCancelRequest={vi.fn()}
          onAcceptRequest={vi.fn()}
          onRejectRequest={vi.fn()}
          onConfirmMatch={vi.fn()}
          onRevokeConfirmMatch={vi.fn()}
          onFinalizePairGroup={vi.fn()}
          onEndConversation={vi.fn()}
          onEndMatch={vi.fn()}
          onNavigate={vi.fn()}
          initialRequestTab="received"
        />
      </SeasonProvider>,
    );

    const sortSwitch = screen.getByRole('switch', { name: '받은 요청을 매칭도 우선으로 정렬' });
    expect(sortSwitch).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('도착순')).toBeInTheDocument();
    expect(screen.getByText('추천 매칭')).toBeInTheDocument();

    await uiUser.click(sortSwitch);

    expect(sortSwitch).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('매칭도순')).toBeInTheDocument();
  });

  it('현재 시즌 이력에서 같은 상대의 반복 취소는 2회 이상이면 요약한다', async () => {
    const uiUser = userEvent.setup();
    const historyRequests: MatchRequest[] = [
      {
        id: 'hist-1',
        fromUserId: 'partner-1',
        toUserId: 'user-1',
        status: 'CANCELLED',
        message: null,
        createdAt: '2099-01-01T00:00:00.000Z',
        expiresAt: '2099-01-02T00:00:00.000Z',
        rejectedAt: null,
        acceptedAt: null,
        resolvedAt: '2099-01-03T00:00:00.000Z',
        resolvedBy: 'partner-1',
      },
      {
        id: 'hist-2',
        fromUserId: 'partner-1',
        toUserId: 'user-1',
        status: 'CANCELLED',
        message: null,
        createdAt: '2099-01-04T00:00:00.000Z',
        expiresAt: '2099-01-05T00:00:00.000Z',
        rejectedAt: null,
        acceptedAt: null,
        resolvedAt: '2099-01-06T00:00:00.000Z',
        resolvedBy: 'partner-1',
      },
    ];

    render(
      <SeasonProvider
        value={{
          season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
          state: 'SEASON_MATCHING',
          isOpen: false,
          isMatching: true,
          daysUntilEnd: 14,
        }}
      >
        <MatchingTab
          user={user}
          matchRequests={historyRequests}
          activeMatch={null}
          profiles={profiles}
          pastSeasons={[]}
          onCancelRequest={vi.fn()}
          onAcceptRequest={vi.fn()}
          onRejectRequest={vi.fn()}
          onConfirmMatch={vi.fn()}
          onRevokeConfirmMatch={vi.fn()}
          onFinalizePairGroup={vi.fn()}
          onEndConversation={vi.fn()}
          onEndMatch={vi.fn()}
          onNavigate={vi.fn()}
        />
      </SeasonProvider>,
    );

    await uiUser.click(screen.getByRole('button', { name: /이력 \(1\)/ }));

    expect(screen.getByText('상대가 2회 요청을 취소했어요')).toBeInTheDocument();
    expect(screen.getAllByText('받은 요청').length).toBeGreaterThan(0);
  });
});
