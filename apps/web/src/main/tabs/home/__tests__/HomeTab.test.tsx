import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonProvider } from '@/contexts/SeasonContext';
import HomeTab from '../HomeTab';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import type { UserProfile } from '@/types/profile';

const baseLifestyle = {} as UserProfile['lifestyle'];
const baseAdditional = { college: null, grade: null, mbti: null, birthYear: null };

const baseUser: UserProfile = {
  id: 'user-1',
  nickname: '삼척유저',
  gender: 'M',
  campus: 'SAMCHEOK',
  dormitoryId: null,
  lifestyle: baseLifestyle,
  intro: '',
  messageToRoommate: null,
  additional: baseAdditional,
};

describe('HomeTab', () => {
  it('비운영 캠퍼스에서 홈 콘텐츠에 inert/aria-hidden을 적용한다', () => {
    render(
      <SeasonProvider
        value={{
          season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
          state: 'OFF_SEASON',
          isOpen: false,
          isMatching: false,
          daysUntilEnd: 0,
        }}
      >
        <HomeTab
          user={baseUser}
          dashboard={createHomeDashboardFixture({
            viewer: {
              ...createHomeDashboardFixture().viewer,
              campusOperated: false,
            },
          })}
          onNavigate={vi.fn()}
        />
      </SeasonProvider>,
    );

    const content = screen.getByTestId('home-content');
    expect(content).toHaveAttribute('aria-hidden', 'true');
    expect(content).toHaveAttribute('inert');
    expect(screen.getByText(/서비스 운영 준비 중이에요/)).toBeInTheDocument();
  });
});
