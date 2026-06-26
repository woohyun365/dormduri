import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeTab from '../HomeTab';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';

describe('HomeTab', () => {
  it('비운영 캠퍼스에서 홈 콘텐츠에 inert/aria-hidden을 적용한다', () => {
    render(
      <HomeTab
        dashboard={createHomeDashboardTestResponse({
          season: {
            ...createHomeDashboardTestResponse().season,
            state: 'OFF_SEASON',
            isOpen: false,
            isMatching: false,
          },
          viewer: {
            ...createHomeDashboardTestResponse().viewer,
            campusOperated: false,
            identity: {
              ...createHomeDashboardTestResponse().viewer.identity,
              user: {
                ...createHomeDashboardTestResponse().viewer.identity.user,
                nickname: '삼척유저',
                campus: 'SAMCHEOK',
              },
              displayIdentity: {
                ...createHomeDashboardTestResponse().viewer.identity.displayIdentity,
                nickname: '삼척유저',
              },
            },
          },
        })}
        onNavigate={vi.fn()}
      />,
    );

    const content = screen.getByTestId('home-content');
    expect(content).toHaveAttribute('aria-hidden', 'true');
    expect(content).toHaveAttribute('inert');
    expect(screen.getByText('서비스 운영 준비 중이에요!')).toBeInTheDocument();
  });
});
