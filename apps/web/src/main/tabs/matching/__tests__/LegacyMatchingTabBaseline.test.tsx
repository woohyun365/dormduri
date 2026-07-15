import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { LegacyMatchingTabBaseline } from '../__stories__/legacy/LegacyMatchingTabBaseline';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import type { ActiveMatch, MatchRequest } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

const lifestyle = {
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
} as UserProfile['lifestyle'];

const user: UserProfile = {
  id: 'user-1',
  nickname: '나',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle,
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
    dormitoryId: 'dasan',
    lifestyle,
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

const request: MatchRequest = {
  id: 'req-1',
  fromUserId: 'partner-1',
  toUserId: 'user-1',
  status: 'PENDING',
  message: '함께 지내고 싶어요',
  createdAt: '2099-01-01T00:00:00.000Z',
  expiresAt: '2099-01-06T00:00:00.000Z',
  rejectedAt: null,
  acceptedAt: null,
  resolvedAt: null,
};

const activeMatch: ActiveMatch = {
  matchId: 'match-1',
  partnerUserId: 'partner-1',
  partnerNickname: '파트너',
  partnerDormitoryId: 'dasan',
  matchScore: 84,
  scoreType: 'full',
  matchedAt: '2099-01-01T00:00:00.000Z',
  cancelRequestedAt: null,
  cancelRequestedBy: null,
};

function renderBaseline(overrides: Partial<ComponentProps<typeof LegacyMatchingTabBaseline>> = {}) {
  return render(
    <SeasonProvider
      value={{
        season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
        state: 'SEASON_MATCHING',
        isOpen: false,
        isMatching: true,
        daysUntilEnd: 14,
      }}
    >
      <LegacyMatchingTabBaseline
        user={user}
        matchRequests={[request]}
        activeMatch={null}
        profiles={profiles}
        pastSeasons={[]}
        onCancelRequest={vi.fn()}
        onAcceptRequest={vi.fn()}
        onRejectRequest={vi.fn()}
        onConfirmMatch={vi.fn()}
        onRevokeConfirmMatch={vi.fn()}
        onEndConversation={vi.fn()}
        onEndMatch={vi.fn()}
        onNavigate={vi.fn()}
        initialRequestTab="received"
        {...overrides}
      />
    </SeasonProvider>,
  );
}

describe('LegacyMatchingTabBaseline pair baseline', () => {
  it('받은 요청 화면에서 정렬 방식을 전환한다', async () => {
    const ui = userEvent.setup();
    renderBaseline();

    const sortSwitch = screen.getByRole('switch', { name: '받은 요청을 매칭도 우선으로 정렬' });
    expect(sortSwitch).toHaveAttribute('aria-checked', 'false');
    await ui.click(sortSwitch);
    expect(sortSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('pair active 카드만 렌더링한다', () => {
    renderBaseline({ matchRequests: [], activeMatch });
    expect(screen.getByText('서로의 룸메이트가 되었어요')).toBeInTheDocument();
    expect(screen.getByText('파트너')).toBeInTheDocument();
  });
});
