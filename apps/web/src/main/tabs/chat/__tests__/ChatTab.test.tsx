import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeasonProvider } from '@/contexts/SeasonContext';
import ChatTab from '../ChatTab';
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
  earphoneExpectation: 'STUDY',
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
  {
    id: 'partner-3',
    nickname: '장보고',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

const activeMatch: ActiveMatch = {
  matchId: 'match-1',
  partnerUserId: 'partner-1',
  partnerNickname: '홍길동',
  partnerDormitoryId: 'dasan',
  matchScore: 84,
  scoreType: 'full',
  matchedAt: '2026-03-03T00:00:00.000Z',
  cancelRequestedAt: null,
  cancelRequestedBy: null,
};

const requests: MatchRequest[] = [
  {
    id: 'req-conv',
    fromUserId: 'partner-2',
    toUserId: 'me',
    status: 'IN_CONVERSATION',
    message: '생활 패턴이 비슷해 보여요',
    createdAt: '2026-03-01T00:00:00.000Z',
    expiresAt: '2026-03-05T00:00:00.000Z',
    rejectedAt: null,
    acceptedAt: '2026-03-02T00:00:00.000Z',
    resolvedAt: null,
  },
  {
    id: 'req-ended',
    fromUserId: 'partner-3',
    toUserId: 'me',
    status: 'CONVERSATION_ENDED',
    message: '안녕하세요',
    createdAt: '2026-02-01T00:00:00.000Z',
    expiresAt: '2026-02-05T00:00:00.000Z',
    rejectedAt: null,
    acceptedAt: '2026-02-02T00:00:00.000Z',
    resolvedAt: '2026-02-06T00:00:00.000Z',
  },
];

function renderChatTab() {
  return render(
    <SeasonProvider
      value={{
        season: { name: '2026-1학기', roomSelectionDate: '2026-04-20' },
        state: 'SEASON_MATCHING',
        isOpen: false,
        isMatching: true,
        daysUntilEnd: 14,
      }}
    >
      <ChatTab
        user={user}
        profiles={profiles}
        matchRequests={requests}
        activeMatch={activeMatch}
        blockedUserIds={new Set()}
        onBlock={vi.fn()}
        onReport={vi.fn()}
        onConfirmMatch={vi.fn()}
        onRevokeConfirmMatch={vi.fn()}
        onEndConversation={vi.fn()}
        onEndMatch={vi.fn()}
        onNavigate={vi.fn()}
      />
    </SeasonProvider>,
  );
}

describe('ChatTab', () => {
  it('정책 기반 섹션 구조를 렌더링한다', () => {
    renderChatTab();

    expect(screen.getByRole('heading', { name: '매칭 확정' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '대화 중' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '지난 대화' })).toBeInTheDocument();
  });

  it('종료된 대화를 열면 읽기 전용 아카이브 안내를 보여준다', async () => {
    const userEventInstance = userEvent.setup();
    renderChatTab();

    const buttons = screen.getAllByRole('button');
    const archiveButton = buttons.find((button) => button.textContent?.includes('지난 대화'));
    if (archiveButton) {
      await userEventInstance.click(archiveButton);
    }

    const endedRoomButton = screen
      .getAllByRole('button')
      .find(
        (button) =>
          button.textContent?.includes('읽기 전용') && button.textContent?.includes('장보고'),
      );

    expect(endedRoomButton).toBeTruthy();
    await userEventInstance.click(endedRoomButton as HTMLElement);

    expect(screen.getByText('읽기 전용 아카이브')).toBeInTheDocument();
    expect(screen.getByText('이 대화는 읽기 전용이에요.')).toBeInTheDocument();
  });
});
