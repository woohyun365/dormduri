import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FAQItem } from '../FAQItem';

vi.mock('lucide-react', () => ({
  ChevronDown: () => null,
}));

describe('FAQItem', () => {
  it('초기 상태에서 답변이 숨겨져 있고 aria-expanded가 false이다', () => {
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    expect(screen.getByRole('heading', { level: 3, name: '질문입니다' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '질문입니다' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('클릭하면 답변이 표시되고 button-region 관계가 연결된다', async () => {
    const user = userEvent.setup();
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    const button = screen.getByRole('button', { name: '질문입니다' });
    await user.click(button);

    const region = screen.getByRole('region');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', region.id);
    expect(region).toHaveAttribute('aria-labelledby', button.id);
    expect(region).toHaveTextContent('답변입니다');
  });

  it('Enter와 Space 키로 disclosure를 토글한다', async () => {
    const user = userEvent.setup();
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    const button = screen.getByRole('button', { name: '질문입니다' });
    button.focus();

    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region')).toBeInTheDocument();

    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('다시 클릭하면 답변이 숨겨진다', async () => {
    const user = userEvent.setup();
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    const button = screen.getByRole('button', { name: '질문입니다' });
    await user.click(button);
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
