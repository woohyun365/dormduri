import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeTab from '../HomeTab';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';

describe('HomeTab', () => {
  it('매칭 등록 완료 상태에서는 checklist 대신 안내 패널과 운영 센터를 렌더링한다', () => {
    render(
      <HomeTab
        dashboard={createHomeDashboardTestResponse({
          season: {
            ...createHomeDashboardTestResponse().season,
            state: 'SEASON_MATCHING',
            isOpen: true,
            isMatching: true,
          },
        })}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('매칭 전에 알아두면 좋아요')).toBeInTheDocument();
    expect(screen.getByText('공지·알림·문의 상태를 확인해요')).toBeInTheDocument();
    expect(screen.queryByText('시즌 통계')).not.toBeInTheDocument();
    expect(screen.queryByText('오늘의 안내')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-section-stats')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-section-tip')).not.toBeInTheDocument();
  });

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
    expect(screen.getByText('해당 캠퍼스는 서비스 운영 준비 중이에요!')).toBeInTheDocument();
    expect(screen.getByTestId('home-non-operated-overlay')).toHaveClass(
      'absolute',
      'overflow-hidden',
      'overscroll-none',
    );
    expect(screen.getByTestId('home-dashboard-container')).toHaveClass(
      'h-[calc(100dvh-14rem)]',
      'overflow-hidden',
    );
  });
});
