import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeMatchingRegisteredGuidePanel } from '../components/HomeMatchingRegisteredGuidePanel';

describe('HomeMatchingRegisteredGuidePanel', () => {
  it('매칭 등록 완료 사용자에게 정책 기반 안내를 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...createHomeDashboardTestResponse().season,
        state: 'SEASON_MATCHING',
        isOpen: true,
        isMatching: true,
      },
    });
    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-08-02T00:00:00+09:00').getTime(),
    });

    render(<HomeMatchingRegisteredGuidePanel viewModel={viewModel} />);

    expect(screen.getByText('매칭 전에 알아두면 좋아요')).toBeInTheDocument();
    expect(screen.getByText('실제 호실 선택은 학교 홈페이지에서 진행해요')).toBeInTheDocument();
    expect(screen.getByText('확정 전에는 서로 다른 후보와도 대화할 수 있어요')).toBeInTheDocument();
    expect(screen.getByText('매칭 상대와의 대화는 시즌 종료일까지 유지돼요')).toBeInTheDocument();
    expect(screen.getByText('불편한 상황은 신고하거나 문의할 수 있어요')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(
      screen.queryByText('매칭 요청은 한 번에 최대 3건까지 보낼 수 있어요'),
    ).not.toBeInTheDocument();
  });
});
