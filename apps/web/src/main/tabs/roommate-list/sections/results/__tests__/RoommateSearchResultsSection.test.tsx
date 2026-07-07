import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateSearchResultsSection } from '../RoommateSearchResultsSection';
import type { RoommateSummaryCardViewModel } from '../../../model/search/roommateSearchViewModel';

const cards: RoommateSummaryCardViewModel[] = [
  {
    id: 'one',
    targetUserId: 'target-one',
    nickname: '첫 번째',
    intro: '아침형 생활을 선호해요.',
    facts: [{ label: '흡연', value: '비흡연' }],
    scoreLabel: '매칭점수 91점',
    summaryOnly: false,
    detailViewable: true,
    resultReadLabel: null,
    actionStateLabel: '매칭 요청 가능',
    bookmarked: false,
    bookmarkAction: null,
    chatAction: {
      visible: true,
      label: '채팅하기',
      accessibilityLabel: '첫 번째 채팅하기',
    },
    detailEntryToken: 'token-one',
  },
  {
    id: 'two',
    targetUserId: 'target-two',
    nickname: '두 번째',
    intro: '조용한 방을 선호해요.',
    facts: [{ label: '관계', value: '각자 생활해요' }],
    scoreLabel: null,
    summaryOnly: true,
    detailViewable: false,
    resultReadLabel: null,
    actionStateLabel: '요약 정보만 표시',
    bookmarked: false,
    bookmarkAction: null,
    chatAction: null,
    detailEntryToken: null,
  },
];

describe('RoommateSearchResultsSection', () => {
  it('result list semantic과 cards를 렌더링한다', () => {
    render(<RoommateSearchResultsSection items={cards} canLoadMore={false} onLoadMore={vi.fn()} />);

    const section = screen.getByRole('region', { name: '룸메이트 검색 결과' });
    const list = within(section).getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list).toHaveClass('grid', 'gap-3');
    expect(list).not.toHaveClass('md:grid-cols-2');
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

  it('next cursor가 없으면 결과 카운트만 표시한다', () => {
    render(<RoommateSearchResultsSection items={cards} canLoadMore={false} onLoadMore={vi.fn()} />);

    expect(screen.getByText('2명의 룸메이트')).toBeInTheDocument();
    expect(screen.queryByText('더 이상 표시할 요약 정보가 없어요.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
  });

  it('detail 가능한 search card만 detail open callback을 호출한다', async () => {
    const onOpenDetail = vi.fn();
    render(
      <RoommateSearchResultsSection
        items={cards}
        canLoadMore={false}
        onLoadMore={vi.fn()}
        onOpenDetail={onOpenDetail}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '첫 번째 프로필 열람하기' }));
    expect(onOpenDetail).toHaveBeenCalledWith(cards[0]);
    expect(
      screen.queryByRole('button', { name: '두 번째 프로필을 열람할 수 없음' }),
    ).not.toBeInTheDocument();
  });

  it('chat 가능한 search card는 start chat callback을 호출한다', async () => {
    const onStartChat = vi.fn();
    render(
      <RoommateSearchResultsSection
        items={cards}
        canLoadMore={false}
        onLoadMore={vi.fn()}
        onStartChat={onStartChat}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '첫 번째 채팅하기' }));
    expect(onStartChat).toHaveBeenCalledWith(cards[0]);
  });

  it('append loading 중에는 기존 card를 유지하고 더 보기 버튼만 loading copy로 잠근다', () => {
    render(
      <RoommateSearchResultsSection items={cards} canLoadMore isLoadingMore onLoadMore={vi.fn()} />,
    );

    expect(screen.getByRole('article', { name: '첫 번째' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '불러오는 중' })).toBeDisabled();
  });
});
