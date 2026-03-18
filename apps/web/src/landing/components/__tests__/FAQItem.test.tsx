import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FAQItem } from '../FAQItem';

vi.mock('lucide-react', () => ({
  ChevronDown: () => null,
}));

describe('FAQItem', () => {
  it('초기 상태에서 답변이 숨겨져 있고 aria-expanded가 false이다', () => {
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    expect(screen.getByRole('button', { name: '질문입니다' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('클릭하면 답변이 표시되고 aria-expanded가 true가 된다', () => {
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    fireEvent.click(screen.getByRole('button', { name: '질문입니다' }));

    expect(screen.getByRole('button', { name: '질문입니다' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByText('답변입니다')).toBeInTheDocument();
  });

  it('다시 클릭하면 답변이 숨겨진다', () => {
    render(<FAQItem question="질문입니다" answer="답변입니다" />);

    fireEvent.click(screen.getByRole('button', { name: '질문입니다' }));
    fireEvent.click(screen.getByRole('button', { name: '질문입니다' }));

    expect(screen.getByRole('button', { name: '질문입니다' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
