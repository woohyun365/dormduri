import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateSearchResultsSection } from '../RoommateSearchResultsSection';
import type { RoommateSummaryCardViewModel } from '../../../model/search/roommateSearchViewModel';

const cards: RoommateSummaryCardViewModel[] = [
  {
    id: 'one',
    nickname: '첫 번째',
    intro: '아침형 생활을 선호해요.',
    facts: [{ label: '흡연', value: '비흡연' }],
    scoreLabel: '적합도 91점',
    summaryOnly: false,
    detailViewable: true,
    resultReadLabel: null,
    actionStateLabel: '매칭 요청 가능',
    bookmarked: false,
    detailEntryToken: 'token-one',
  },
  {
    id: 'two',
    nickname: '두 번째',
    intro: '조용한 방을 선호해요.',
    facts: [{ label: '관계', value: '적당한 거리' }],
    scoreLabel: null,
    summaryOnly: true,
    detailViewable: false,
    resultReadLabel: null,
    actionStateLabel: '요약 정보만 표시',
    bookmarked: false,
    detailEntryToken: null,
  },
];

describe('RoommateSearchResultsSection', () => {
  it('result list semantic과 cards를 렌더링한다', () => {
    render(<RoommateSearchResultsSection items={cards} canLoadMore={false} onLoadMore={vi.fn()} />);

    const section = screen.getByRole('region', { name: '룸메이트 검색 결과' });
    const list = within(section).getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(section).getByRole('article', { name: '첫 번째' })).toBeInTheDocument();
    expect(within(section).getByRole('article', { name: '두 번째' })).toBeInTheDocument();
  });

  it('cursor 기반 더 보기 버튼만 제공하고 남은 개수 추정 copy를 만들지 않는다', async () => {
    const onLoadMore = vi.fn();
    render(<RoommateSearchResultsSection items={cards} canLoadMore onLoadMore={onLoadMore} />);

    await userEvent.click(screen.getByRole('button', { name: '더 보기' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/남은 \d/)).not.toBeInTheDocument();
  });

  it('next cursor가 없으면 종료 copy만 표시한다', () => {
    render(<RoommateSearchResultsSection items={cards} canLoadMore={false} onLoadMore={vi.fn()} />);

    expect(screen.getByText('더 이상 표시할 요약 정보가 없어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
  });
});
