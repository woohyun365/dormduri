import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('메시지를 표시한다', () => {
    render(<EmptyState message="데이터가 없어요" />);

    expect(screen.getByText('데이터가 없어요')).toBeInTheDocument();
  });

  it('아이콘이 있으면 렌더링한다', () => {
    render(<EmptyState icon={<span data-testid="icon">🏠</span>} message="없어요" />);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('action이 없으면 버튼을 렌더링하지 않는다', () => {
    render(<EmptyState message="없어요" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('action이 있으면 CTA 버튼을 렌더링한다', () => {
    render(
      <EmptyState
        message="매칭 요청이 없어요"
        action={{ label: '룸메이트 둘러보기', onClick: () => {} }}
      />,
    );

    expect(screen.getByRole('button', { name: '룸메이트 둘러보기' })).toBeInTheDocument();
  });

  it('CTA 버튼 클릭 시 onClick이 호출된다', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<EmptyState message="없어요" action={{ label: '둘러보기', onClick: handleClick }} />);

    await user.click(screen.getByRole('button', { name: '둘러보기' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
