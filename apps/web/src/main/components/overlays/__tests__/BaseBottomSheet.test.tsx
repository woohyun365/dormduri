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
    const sheet = dialog.querySelector('.max-w-dvw');
    const scrollContainer = dialog.querySelector('.overflow-x-hidden.overflow-y-auto');

    expect(sheet).toHaveClass('min-w-0', 'max-w-dvw');
    expect(scrollContainer).toHaveClass('min-w-0', 'overflow-x-hidden', 'overflow-y-auto');
  });

  it('스크롤·transform ancestor 밖의 body portal에 렌더링해 viewport 상단 header를 유지한다', () => {
    const { container } = render(
      <div data-testid="transformed-scroll-owner" style={{ transform: 'translateY(200px)' }}>
        <BaseBottomSheet isOpen onClose={vi.fn()} title="룸메이트 상세 정보">
          <div className="h-[1200px]">content</div>
        </BaseBottomSheet>
      </div>,
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 정보' });

    expect(container).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByRole('heading', { name: '룸메이트 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '닫기' })).toBeVisible();
  });
});
