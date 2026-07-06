import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateBookmarkResultsSection } from '../RoommateBookmarkResultsSection';
import type { RoommateSummaryCardViewModel } from '../../../model/search/roommateSearchViewModel';

const card: RoommateSummaryCardViewModel = {
  id: 'bookmark-1',
  targetUserId: 'target-1',
  nickname: '북마크 룸메이트',
  intro: '다시 확인하고 싶은 룸메이트예요.',
  facts: [{ label: '흡연', value: '비흡연' }],
  scoreLabel: '적합도 91점',
  summaryOnly: true,
  detailViewable: false,
  resultReadLabel: null,
  actionStateLabel: '관심 목록에서 관리 중',
  bookmarked: true,
  bookmarkAction: {
    visible: true,
    bookmarked: true,
    disabled: false,
    label: '관심 목록 해제',
    accessibilityLabel: '북마크 룸메이트 관심 목록 해제',
  },
  detailEntryToken: null,
};

describe('RoommateBookmarkResultsSection', () => {
  it('RECENT/MATCH_SCORE sort와 owner list card action을 렌더링한다', async () => {
    const onSortChange = vi.fn();
    const onBookmarkToggle = vi.fn();
    render(
      <RoommateBookmarkResultsSection
        status="success"
        sort="RECENT"
        items={[card]}
        emptyState={null}
        error={null}
        canLoadMore
        onSortChange={onSortChange}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onBookmarkToggle={onBookmarkToggle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '적합도순' }));
    expect(onSortChange).toHaveBeenCalledWith('MATCH_SCORE');

    await userEvent.click(screen.getByRole('button', { name: '북마크 룸메이트 관심 목록 해제' }));
    expect(onBookmarkToggle).toHaveBeenCalledWith('target-1', true);
  });

  it('NO_BOOKMARKS와 NO_VISIBLE_BOOKMARKS safe empty copy를 구분한다', () => {
    const { rerender } = render(
      <RoommateBookmarkResultsSection
        status="success"
        sort="RECENT"
        items={[]}
        emptyState="NO_BOOKMARKS"
        error={null}
        canLoadMore={false}
        onSortChange={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onBookmarkToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('아직 관심 목록에 저장한 룸메이트가 없어요.')).toBeInTheDocument();

    rerender(
      <RoommateBookmarkResultsSection
        status="success"
        sort="RECENT"
        items={[]}
        emptyState="NO_VISIBLE_BOOKMARKS"
        error={null}
        canLoadMore={false}
        onSortChange={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onBookmarkToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('저장한 항목이 현재 정책상 보이지 않아요.')).toBeInTheDocument();
    expect(screen.getByText(/숨김 사유나 대상 정보는 노출하지 않고/)).toBeInTheDocument();
  });
});
