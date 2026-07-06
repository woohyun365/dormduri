import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { RoommateSummaryCard } from '../RoommateSummaryCard';
import type { RoommateSummaryCardViewModel } from '../../model/search/roommateSearchViewModel';

const baseCard: RoommateSummaryCardViewModel = {
  id: 'card-1',
  targetUserId: 'target-1',
  nickname: '테스트 룸메이트',
  intro: '조용한 생활을 선호해요.',
  facts: [
    { label: '흡연', value: '비흡연' },
    { label: '잠버릇', value: '없음' },
    { label: '관계', value: '적당한 거리' },
  ],
  scoreLabel: '적합도 88점',
  summaryOnly: false,
  detailViewable: true,
  resultReadLabel: '현재 매칭 결과 읽기',
  actionStateLabel: '매칭 요청 가능',
  bookmarked: true,
  bookmarkAction: {
    visible: true,
    bookmarked: true,
    disabled: false,
    label: '관심 목록 해제',
    accessibilityLabel: '테스트 룸메이트 관심 목록 해제',
  },
  detailEntryToken: 'detail-token-must-not-render',
};

describe('RoommateSummaryCard', () => {
  it('article semantic과 accessible 상태 copy를 렌더링한다', () => {
    render(<RoommateSummaryCard item={baseCard} />);

    const article = screen.getByRole('article', { name: '테스트 룸메이트' });
    expect(article).toBeInTheDocument();
    expect(within(article).getByText('조용한 생활을 선호해요.')).toBeInTheDocument();
    expect(within(article).getByText('적합도 88점')).toBeInTheDocument();
    expect(within(article).getByText('상세 보기 가능')).toBeInTheDocument();
    expect(within(article).getByText('현재 매칭 결과 읽기')).toBeInTheDocument();
    expect(within(article).getByText('관심 목록에 있음')).toBeInTheDocument();
    expect(within(article).getByText('매칭 요청 가능')).toBeInTheDocument();
  });

  it('summary-only card는 score/token/private field를 노출하지 않는다', () => {
    render(
      <RoommateSummaryCard
        item={{
          ...baseCard,
          scoreLabel: null,
          summaryOnly: true,
          detailViewable: false,
          resultReadLabel: null,
          bookmarked: false,
          bookmarkAction: null,
          actionStateLabel: '다른 건물이라 요약만 볼 수 있어요',
        }}
      />,
    );

    expect(screen.getByText('요약만 보기')).toBeInTheDocument();
    expect(screen.queryByText(/적합도/)).not.toBeInTheDocument();
    expect(screen.queryByText('detail-token-must-not-render')).not.toBeInTheDocument();
    expect(screen.queryByText(/음주/)).not.toBeInTheDocument();
  });

  it('bookmark action은 targetUserId와 현재 bookmarked 상태만 전달한다', async () => {
    const onBookmarkToggle = vi.fn();
    render(<RoommateSummaryCard item={baseCard} onBookmarkToggle={onBookmarkToggle} />);

    await userEvent.click(screen.getByRole('button', { name: '테스트 룸메이트 관심 목록 해제' }));

    expect(onBookmarkToggle).toHaveBeenCalledWith('target-1', true);
  });
});
