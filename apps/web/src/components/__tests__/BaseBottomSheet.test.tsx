import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseBottomSheet } from '../BaseBottomSheet';

describe('BaseBottomSheet', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('모바일 viewport에서 dialog content의 x축 overflow가 sheet 폭을 키우지 않도록 막는다', () => {
    render(
      <BaseBottomSheet isOpen onClose={vi.fn()} title="상세 정보">
        <div>content</div>
      </BaseBottomSheet>,
    );

    const dialog = screen.getByRole('dialog', { name: '상세 정보' });
    const sheet = dialog.querySelector('.max-w-\\[100dvw\\]');
    const scrollContainer = dialog.querySelector('.overflow-x-hidden.overflow-y-auto');

    expect(sheet).toHaveClass('min-w-0', 'max-w-[100dvw]');
    expect(scrollContainer).toHaveClass('min-w-0', 'overflow-x-hidden', 'overflow-y-auto');
  });
});
