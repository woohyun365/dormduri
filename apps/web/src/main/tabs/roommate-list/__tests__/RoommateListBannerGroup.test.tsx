import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoommateListBannerGroup } from '../RoommateListBannerGroup';
import type { UserProfile } from '@/types/profile';

vi.mock('@/utils/profileCompletion', () => ({
  getProfileCompletion: vi.fn(() => ({
    percent: 60,
    filledOptional: 2,
    totalOptional: 5,
    isComplete: false,
  })),
}));

vi.mock('@/components/ContextualTip', () => ({
  ContextualTip: ({ message }: { message: string }) => (
    <div data-testid="contextual-tip">{message}</div>
  ),
}));

const baseUser: UserProfile = {
  nickname: '테스터',
  gender: 'M',
  dormitoryId: 'dasan',
  lifestyle: {
    smoker: 'NO',
    sleepHabit: 'NONE',
    indoorEating: 'NO',
    bedtime: '22_24',
    wakeTime: '06_08',
    noiseSensitivity: 'MID',
    cleanliness: 'MID',
    relationshipStyle: 'CASUAL',
  },
  intro: '안녕하세요',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, temperatureSensitivity: null },
};

const defaultProps = {
  user: baseUser,
  isUnassigned: false,
  showProfileBanner: false,
  onNavigate: vi.fn(),
  filteredProfilesCount: 0,
};

describe('RoommateListBannerGroup', () => {
  it('isUnassigned일 때 미배정 배너를 표시한다', () => {
    render(<RoommateListBannerGroup {...defaultProps} isUnassigned />);
    expect(screen.getByText('건물을 먼저 선택해주세요')).toBeInTheDocument();
  });

  it('배정된 유저에게 미배정 배너를 숨긴다', () => {
    render(<RoommateListBannerGroup {...defaultProps} isUnassigned={false} />);
    expect(screen.queryByText('건물을 먼저 선택해주세요')).not.toBeInTheDocument();
  });

  it('프로필 미완성 + showProfileBanner → 완성도 배너를 표시한다', () => {
    render(<RoommateListBannerGroup {...defaultProps} showProfileBanner />);
    expect(screen.getByText(/프로필 완성도 60%/)).toBeInTheDocument();
  });

  it('프로필 수 > 0이면 카운트 텍스트를 표시한다', () => {
    render(<RoommateListBannerGroup {...defaultProps} filteredProfilesCount={15} />);
    expect(screen.getByText('15명의 룸메이트')).toBeInTheDocument();
  });
});
