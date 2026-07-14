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
    { label: '흡연 여부', value: '비흡연' },
    { label: '잠버릇', value: '잠버릇 없음' },
    { label: '관계', value: '각자 생활해요' },
  ],
  metadataLabel: '예지원 (여)',
  scoreLabel: '매칭점수 88점',
  summaryOnly: false,
  detailViewable: true,
  pendingMatchRequest: null,
  actionStateLabel: '매칭 요청 가능',
  actionStateBadges: [
    { label: '대화 가능', tone: 'green' },
    { label: '매칭 신청 불가', tone: 'amber' },
    { label: '매칭 기간에만 매칭이 가능해요', tone: 'slate' },
  ],
  bookmarked: true,
  bookmarkAction: {
    visible: true,
    bookmarked: true,
    disabled: false,
    label: '관심 목록 해제',
    accessibilityLabel: '테스트 룸메이트 관심 목록 해제',
  },
  chatAction: null,
  detailEntryToken: 'detail-token-must-not-render',
};

describe('RoommateSummaryCard', () => {
  it('article semantic과 accessible 상태 copy를 렌더링한다', () => {
    const { container } = render(<RoommateSummaryCard item={baseCard} />);

    const article = screen.getByRole('article', { name: '테스트 룸메이트' });
    expect(article).toBeInTheDocument();
    expect(within(article).getByText('조용한 생활을 선호해요.')).toBeInTheDocument();
    expect(within(article).getByText('매칭점수 88점')).toBeInTheDocument();
    expect(within(article).getAllByText('비흡연').length).toBeGreaterThan(0);
    expect(within(article).getAllByText('잠버릇 없음').length).toBeGreaterThan(0);
    expect(within(article).getAllByText('각자 생활해요').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('svg.text-slate-500')).toHaveLength(3);
    expect(container.querySelector('svg.text-yellow-500')).not.toBeInTheDocument();
    expect(container.querySelector('svg.text-orange-500')).not.toBeInTheDocument();
    expect(within(article).queryByText('🚭')).not.toBeInTheDocument();
    expect(within(article).getByText('예지원 (여)')).toBeInTheDocument();
    expect(within(article).getByText('프로필 열람 가능')).toBeInTheDocument();
    expect(within(article).queryByText('현재 매칭 결과 읽기')).not.toBeInTheDocument();
    expect(within(article).queryByText('관심 목록에 있음')).not.toBeInTheDocument();
    expect(within(article).getByText('대화 가능')).toHaveClass('text-emerald-700');
    expect(within(article).getByText('매칭 신청 불가')).toHaveClass('text-amber-700');
    expect(within(article).getByText('매칭 기간에만 매칭이 가능해요')).toHaveClass(
      'text-slate-600',
    );
    expect(within(article).queryByText('열람 범위')).not.toBeInTheDocument();
    expect(within(article).queryByText('가능한 행동')).not.toBeInTheDocument();
    expect(within(article).queryByText('저장 상태')).not.toBeInTheDocument();
    expect(within(article).getByText('테')).toHaveClass('bg-rose-100', 'text-rose-600');
  });

  it('받은 매칭 요청 pill은 다른 상태 pill처럼 별도 테두리 없이 렌더링한다', () => {
    render(
      <RoommateSummaryCard
        item={{
          ...baseCard,
          actionStateBadges: [{ label: '매칭 요청을 받은 사용자', tone: 'purple' }],
        }}
      />,
    );

    expect(screen.getByText('매칭 요청을 받은 사용자')).toHaveClass(
      'bg-purple-50',
      'text-purple-700',
    );
    expect(screen.getByText('매칭 요청을 받은 사용자')).not.toHaveClass('border-purple-200');
  });

  it('대화 중 pill은 HomeTab 대화 metric과 맞춘 teal tone으로 렌더링한다', () => {
    render(
      <RoommateSummaryCard
        item={{
          ...baseCard,
          actionStateBadges: [{ label: '대화 중', tone: 'teal' }],
        }}
      />,
    );

    expect(screen.getByText('대화 중')).toHaveClass('bg-teal-50', 'text-teal-700');
  });

  it('빈 자기소개는 slate placeholder로 렌더링한다', () => {
    render(<RoommateSummaryCard item={{ ...baseCard, intro: '-' }} />);

    const placeholder = screen.getByText('-');
    expect(placeholder).toHaveClass('text-slate-500');
    expect(placeholder.closest('div')).toHaveClass('bg-slate-50');
  });

  it('summary-only card는 score/token/private field를 노출하지 않는다', () => {
    render(
      <RoommateSummaryCard
        item={{
          ...baseCard,
          scoreLabel: null,
          summaryOnly: true,
          detailViewable: false,
          metadataLabel: '춘천캠퍼스',
          profileVisibilityBadge: null,
          bookmarked: false,
          bookmarkAction: null,
          chatAction: null,
          actionStateLabel: '다른 건물 유저는 프로필 요약만 확인 가능해요',
          actionStateBadges: [
            { label: '다른 건물 유저는 프로필 요약만 확인 가능해요', tone: 'slate' },
          ],
        }}
      />,
    );

    expect(screen.getByText('춘천캠퍼스')).toBeInTheDocument();
    expect(screen.queryByText('프로필 열람 불가')).not.toBeInTheDocument();
    expect(screen.queryByText('대화 불가')).not.toBeInTheDocument();
    expect(screen.queryByText('매칭 신청 불가')).not.toBeInTheDocument();
    expect(screen.getByText('다른 건물 유저는 프로필 요약만 확인 가능해요')).toHaveClass(
      'text-slate-600',
    );
    expect(screen.queryByText('미리보기')).not.toBeInTheDocument();
    expect(screen.queryByText('공개 요약만 표시')).not.toBeInTheDocument();
    expect(screen.queryByText(/매칭점수/)).not.toBeInTheDocument();
    expect(screen.queryByText('detail-token-must-not-render')).not.toBeInTheDocument();
    expect(screen.queryByText(/음주/)).not.toBeInTheDocument();
  });

  it('매칭점수 badge는 score threshold color를 따른다', () => {
    const { rerender } = render(
      <RoommateSummaryCard item={{ ...baseCard, scoreLabel: '매칭점수 85점' }} />,
    );
    expect(screen.getByText('매칭점수 85점')).toHaveClass('text-green-600', 'bg-green-100');

    rerender(<RoommateSummaryCard item={{ ...baseCard, scoreLabel: '매칭점수 70점' }} />);
    expect(screen.getByText('매칭점수 70점')).toHaveClass('text-blue-600', 'bg-blue-100');

    rerender(<RoommateSummaryCard item={{ ...baseCard, scoreLabel: '매칭점수 50점' }} />);
    expect(screen.getByText('매칭점수 50점')).toHaveClass('text-sky-600', 'bg-sky-100');

    rerender(<RoommateSummaryCard item={{ ...baseCard, scoreLabel: '매칭점수 49점' }} />);
    expect(screen.getByText('매칭점수 49점')).toHaveClass('bg-slate-200');
  });

  it('매칭점수 계산 오류 badge는 amber error tone을 유지한다', () => {
    render(<RoommateSummaryCard item={{ ...baseCard, scoreLabel: '서버 오류' }} />);

    expect(screen.getByText('서버 오류')).toHaveClass(
      'border-amber-200',
      'bg-amber-50',
      'text-amber-700',
    );
  });

  it('프로필 요약 pill은 흡연과 잠버릇 있음 상태를 icon 색상만으로 구분한다', () => {
    const { container } = render(
      <RoommateSummaryCard
        item={{
          ...baseCard,
          facts: [
            { label: '흡연 여부', value: '흡연' },
            { label: '잠버릇', value: '잠버릇 있음' },
            { label: '관계', value: '친하게 지내요' },
          ],
        }}
      />,
    );

    expect(container.querySelector('svg.text-rose-400')).toBeInTheDocument();
    expect(container.querySelector('svg.text-amber-400')).toBeInTheDocument();
    const sleepHabitChip = screen
      .getAllByText('잠버릇 있음')
      .map((element) => element.closest('span'))
      .find((element) => element?.classList.contains('bg-slate-50'));
    expect(sleepHabitChip).toHaveClass('border-slate-200', 'bg-slate-50', 'text-slate-700');
    expect(container.querySelectorAll('svg.text-slate-500')).toHaveLength(1);
    expect(container.querySelector('svg.text-yellow-500')).not.toBeInTheDocument();
    expect(container.querySelector('svg.text-orange-500')).not.toBeInTheDocument();
  });

  it('chat action이 열려 있으면 카드에서 대화 CTA를 제공한다', async () => {
    const onStartChat = vi.fn();
    render(
      <RoommateSummaryCard
        item={{
          ...baseCard,
          actionStateLabel: '대화 가능',
          chatAction: {
            visible: true,
            label: '채팅하기',
            accessibilityLabel: '테스트 룸메이트 채팅하기',
          },
        }}
        onStartChat={onStartChat}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '테스트 룸메이트 채팅하기' }));
    expect(onStartChat).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: 'target-1', nickname: '테스트 룸메이트' }),
    );
  });

  it('bookmark action은 targetUserId와 현재 bookmarked 상태만 전달한다', async () => {
    const onBookmarkToggle = vi.fn();
    render(<RoommateSummaryCard item={baseCard} onBookmarkToggle={onBookmarkToggle} />);

    await userEvent.click(screen.getByRole('button', { name: '테스트 룸메이트 관심 목록 해제' }));

    expect(onBookmarkToggle).toHaveBeenCalledWith('target-1', true);
  });

  it('detail action은 token 있는 detail-viewable card만 연다', async () => {
    const onOpenDetail = vi.fn();
    const { rerender } = render(
      <RoommateSummaryCard
        item={baseCard}
        detailAction={{
          enabled: true,
          label: '프로필 열람하기',
          accessibilityLabel: '테스트 룸메이트 프로필 열람하기',
          onOpen: () => onOpenDetail(baseCard),
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '테스트 룸메이트 프로필 열람하기' }));
    expect(onOpenDetail).toHaveBeenCalledWith(baseCard);

    rerender(
      <RoommateSummaryCard
        item={baseCard}
        detailAction={{
          enabled: false,
          label: '프로필 열람 불가',
          accessibilityLabel: '테스트 룸메이트 프로필을 열람할 수 없음',
          onOpen: () => onOpenDetail(baseCard),
        }}
      />,
    );
    expect(
      screen.getByRole('button', { name: '테스트 룸메이트 프로필을 열람할 수 없음' }),
    ).toBeDisabled();
  });
});
