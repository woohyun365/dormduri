import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeProgressSection } from '../HomeProgressSection';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { isChecklistComplete } from '@/utils/onboarding';
import type { UserProfile } from '@/types/profile';

vi.mock('@/utils/profileCompletion');
vi.mock('@/utils/onboarding', async () => {
  const actual = await vi.importActual('@/utils/onboarding');
  return {
    ...actual,
    isChecklistComplete: vi.fn(),
  };
});

vi.mock('../../../components/OnboardingChecklist', () => ({
  OnboardingChecklist: ({
    onDismiss,
  }: {
    onNavigate: (target: string) => void;
    onDismiss: () => void;
  }) => (
    <div data-testid="onboarding-checklist">
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
}));

const baseUser: UserProfile = {
  id: 'test-user-0001',
  nickname: '테스터',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: {
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
  },
  intro: '안녕하세요',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
};

const defaultProps = {
  user: baseUser,
  bookmarkedUserIds: new Set<string>(),
  onNavigate: vi.fn(),
};

beforeEach(() => {
  vi.mocked(getProfileCompletion).mockReturnValue({
    percent: 60,
    filledOptional: 2,
    totalOptional: 5,
    isComplete: false,
  });
  vi.mocked(isChecklistComplete).mockReturnValue(false);
});

describe('HomeProgressSection', () => {
  it('체크리스트 미완료 + 미닫힘 → OnboardingChecklist를 표시한다', () => {
    render(<HomeProgressSection {...defaultProps} />);
    expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
  });

  it('체크리스트 완료 → 프로필 완성도를 표시한다', () => {
    vi.mocked(isChecklistComplete).mockReturnValue(true);
    render(<HomeProgressSection {...defaultProps} />);
    expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('체크리스트 닫힘 → 프로필 완성도를 표시한다', () => {
    render(<HomeProgressSection {...defaultProps} isChecklistDismissed />);
    expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
    expect(screen.getByText('프로필 완성도')).toBeInTheDocument();
  });

  it('모든 선택항목 입력 시 "모든 항목이 입력되었어요"를 표시한다', () => {
    vi.mocked(isChecklistComplete).mockReturnValue(true);
    vi.mocked(getProfileCompletion).mockReturnValue({
      percent: 100,
      filledOptional: 5,
      totalOptional: 5,
      isComplete: true,
    });
    const completeUser = {
      ...baseUser,
      messageToRoommate: '메시지',
      additional: {
        college: 'IT대' as const,
        grade: '1' as const,
        mbti: 'ENTP',
        // birthYear로 교체
        birthYear: 2004,
      },
    };
    render(<HomeProgressSection {...defaultProps} user={completeUser} />);
    expect(screen.getByText('모든 항목이 입력되었어요!')).toBeInTheDocument();
  });

  it('미입력 항목이 있으면 뱃지를 표시한다', () => {
    vi.mocked(isChecklistComplete).mockReturnValue(true);
    render(<HomeProgressSection {...defaultProps} />);
    // baseUser has null: messageToRoommate, college, grade, mbti, birthYear
    expect(screen.getByText('룸메에게 한마디')).toBeInTheDocument();
    expect(screen.getByText('단대')).toBeInTheDocument();
    expect(screen.getByText('MBTI')).toBeInTheDocument();
  });
});
