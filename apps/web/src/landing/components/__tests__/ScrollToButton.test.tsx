import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScrollToButton } from '../ScrollToButton';

describe('ScrollToButton', () => {
  it('클릭 시 대상 요소의 scrollIntoView를 호출한다', () => {
    const scrollIntoView = vi.fn();
    const target = document.createElement('div');
    target.id = 'features';
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    render(<ScrollToButton targetId="features">서비스 소개 보기</ScrollToButton>);
    fireEvent.click(screen.getByRole('button', { name: '서비스 소개 보기' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });

    document.body.removeChild(target);
  });

  it('대상 요소가 없으면 에러 없이 무시한다', () => {
    render(<ScrollToButton targetId="nonexistent">스크롤</ScrollToButton>);

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: '스크롤' }));
    }).not.toThrow();
  });
});
