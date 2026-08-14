import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MatchingTabView } from '../../MatchingTab';

const historySummary = { seasons: 2, matchedCount: 1, unmatchedCount: 0 } as const;

describe('MatchingTab navigation intent', () => {
  it('비시즌과 결과 없음 상태는 policy action 대신 내부 history section만 연다', async () => {
    const user = userEvent.setup();
    const onSelectSection = vi.fn();
    const onNavigationIntent = vi.fn();

    render(
      <MatchingTabView
        state={{ kind: 'off-season', historySummary }}
        onSelectSection={onSelectSection}
        onNavigationIntent={onNavigationIntent}
      />,
    );

    await user.click(screen.getByRole('button', { name: '지난 매칭 기록 보기' }));

    expect(onSelectSection).toHaveBeenCalledWith('past');
    expect(onNavigationIntent).not.toHaveBeenCalled();
  });

  it('시즌 준비는 Home 등록 owner로 안내한다', async () => {
    const user = userEvent.setup();
    const onNavigationIntent = vi.fn();

    render(
      <MatchingTabView
        state={{ kind: 'season-open', historySummary }}
        onNavigationIntent={onNavigationIntent}
      />,
    );

    await user.click(screen.getByRole('button', { name: '시즌 등록 확인하기' }));
    expect(onNavigationIntent).toHaveBeenLastCalledWith('home');
  });

  it('시즌 매칭 등록 gate도 공통 current 안내에서 Home owner로 연결한다', async () => {
    const user = userEvent.setup();
    const onNavigationIntent = vi.fn();

    render(
      <MatchingTabView
        state={{
          kind: 'unavailable',
          reason: 'VIEWER_NOT_REGISTERED',
          seasonState: 'SEASON_MATCHING',
          historySummary,
        }}
        onNavigationIntent={onNavigationIntent}
      />,
    );

    expect(screen.getByRole('heading', { name: '시즌 등록이 필요해요' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '시즌 등록 확인하기' }));
    expect(onNavigationIntent).toHaveBeenCalledWith('home');
  });

  it('post-match 결과 없음은 별도 결과 CTA 없이 활동 이력만 제공한다', () => {
    render(
      <MatchingTabView
        state={{ kind: 'season-post-match', activeMatch: null, historySummary, activity: [] }}
      />,
    );

    expect(screen.getByRole('heading', { name: '활동 이력' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지난 매칭 기록 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /요청|매칭 해제/ })).not.toBeInTheDocument();
  });

  it('legacy identity header의 avatar는 기존 profile owner로만 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigationIntent = vi.fn();

    render(
      <MatchingTabView
        state={{
          kind: 'season-matching',
          current: {
            activeMatch: null,
            serverNow: '2026-08-01T00:00:00.000Z',
            roomSelectionDate: '2026-08-10',
            seasonEndDate: '2026-08-31',
            requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
            receivedPendingCount: 0,
            activity: [],
          },
        }}
        viewerHeader={{
          nickname: '나',
          gender: 'M',
          campusLabel: '춘천캠퍼스',
          residenceLabel: '다산관 · 2인실',
        }}
        onNavigationIntent={onNavigationIntent}
      />,
    );

    await user.click(screen.getByRole('button', { name: '나 프로필 보기' }));
    expect(onNavigationIntent).toHaveBeenCalledWith('profile');
  });
});
