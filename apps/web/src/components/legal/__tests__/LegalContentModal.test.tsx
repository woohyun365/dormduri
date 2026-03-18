import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LegalContentModal } from '../LegalContentModal';

vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x" />,
}));

describe('LegalContentModal', () => {
  const onClose = vi.fn();
  const defaultProps = {
    title: '서비스 이용약관',
    content: '약관 내용입니다.',
    onClose,
  };

  beforeEach(() => {
    onClose.mockClear();
  });

  it('제목과 내용을 렌더링한다', () => {
    render(<LegalContentModal {...defaultProps} />);

    expect(screen.getByText('서비스 이용약관')).toBeInTheDocument();
    expect(screen.getByText('약관 내용입니다.')).toBeInTheDocument();
  });

  it('dialog role과 aria 속성이 올바르다', () => {
    render(<LegalContentModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'legal-modal-title');
  });

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    render(<LegalContentModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape 키 입력 시 onClose를 호출한다', () => {
    render(<LegalContentModal {...defaultProps} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('배경 클릭 시 onClose를 호출한다', () => {
    render(<LegalContentModal {...defaultProps} />);

    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('모달 내부 클릭은 onClose를 호출하지 않는다', () => {
    render(<LegalContentModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('마운트 시 닫기 버튼에 포커스가 이동한다', () => {
    render(<LegalContentModal {...defaultProps} />);

    expect(document.activeElement).toBe(screen.getByLabelText('닫기'));
  });

  it('unmount 시 이전 포커스 요소로 복원한다', () => {
    const externalButton = document.createElement('button');
    externalButton.textContent = '외부 버튼';
    document.body.appendChild(externalButton);
    externalButton.focus();

    const { unmount } = render(<LegalContentModal {...defaultProps} />);

    expect(document.activeElement).toBe(screen.getByLabelText('닫기'));

    unmount();

    expect(document.activeElement).toBe(externalButton);
    document.body.removeChild(externalButton);
  });
});
