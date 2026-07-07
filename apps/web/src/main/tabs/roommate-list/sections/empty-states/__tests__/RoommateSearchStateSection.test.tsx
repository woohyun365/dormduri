import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateSearchStateSection } from '../RoommateSearchStateSection';

describe('RoommateSearchStateSection', () => {
  it('closed state를 status role로 표시한다', () => {
    render(<RoommateSearchStateSection state={{ kind: 'closed', message: '탐색이 닫혔어요.' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('탐색이 닫혔어요.');
  });

  it('loading state를 status role과 안전 문구로 표시한다', () => {
    render(<RoommateSearchStateSection state={{ kind: 'loading' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('룸메이트 목록을 불러오는 중이에요');
    expect(
      screen.getByText('공개 가능한 요약 정보와 현재 시즌 상태를 확인하고 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('roommate-search-loading-skeleton')).toBeInTheDocument();
  });

  it('error state에서 retry를 호출한다', async () => {
    const onRetry = vi.fn();
    render(
      <RoommateSearchStateSection
        state={{ kind: 'error', message: '룸메이트 찾기 정보를 불러오지 못했어요.', onRetry }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('룸메이트 찾기 정보를 불러오지 못했어요.');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('empty state에서 notice 기반 제목/본문을 표시한다', () => {
    render(
      <RoommateSearchStateSection
        state={{
          kind: 'empty',
          title: '조건에 맞는 룸메이트가 아직 없어요',
          message: '필터를 조금 넓히거나 다른 정렬로 다시 확인해 보세요.',
        }}
      />,
    );

    expect(screen.getByText('조건에 맞는 룸메이트가 아직 없어요')).toBeInTheDocument();
    expect(
      screen.getByText('필터를 조금 넓히거나 다른 정렬로 다시 확인해 보세요.'),
    ).toBeInTheDocument();
  });

  it('warning empty state에서 강조 문구와 CTA action을 표시한다', async () => {
    const onClick = vi.fn();

    render(
      <RoommateSearchStateSection
        state={{
          kind: 'empty',
          title: '확인이 필요한 상태예요.',
          message: '현재 상태를 확인한 뒤 다시 시도해 주세요.',
          tone: 'warning',
          action: {
            label: '상태 확인하기',
            onClick,
          },
        }}
      />,
    );

    expect(screen.getByText('확인이 필요한 상태예요.')).toBeInTheDocument();
    expect(screen.getByText('현재 상태를 확인한 뒤 다시 시도해 주세요.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '상태 확인하기' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
