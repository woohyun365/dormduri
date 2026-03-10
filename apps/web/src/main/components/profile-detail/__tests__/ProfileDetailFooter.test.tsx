import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildProfileDetailFooter } from '../ProfileDetailFooter';

vi.mock('@/utils/matchButtonStyle', () => ({
  getMatchButtonStyle: vi.fn((state: { type: string }) => {
    if (state.type === 'REQUEST')
      return { label: '매칭 요청', className: 'bg-primary', clickable: true };
    if (state.type === 'PENDING_SENT')
      return { label: '요청됨', className: 'bg-gray', clickable: false };
    return { label: 'unknown', className: 'bg-gray', clickable: false };
  }),
}));

describe('buildProfileDetailFooter', () => {
  it('hideMatchButton이 true이면 undefined를 반환한다', () => {
    const result = buildProfileDetailFooter({
      hideMatchButton: true,
      onRequestMatch: vi.fn(),
    });
    expect(result).toBeUndefined();
  });

  it('matchButtonState가 clickable이면 클릭 시 onRequestMatch를 호출한다', () => {
    const onRequestMatch = vi.fn();
    const node = buildProfileDetailFooter({
      matchButtonState: { type: 'REQUEST', label: '매칭 요청' },
      onRequestMatch,
    });

    render(<>{node}</>);
    fireEvent.click(screen.getByRole('button'));
    expect(onRequestMatch).toHaveBeenCalled();
  });

  it('matchButtonState가 non-clickable이면 버튼이 비활성화된다', () => {
    const onRequestMatch = vi.fn();
    const node = buildProfileDetailFooter({
      matchButtonState: {
        type: 'PENDING_SENT',
        label: '요청 대기 중',
        requestId: 'r1',
        expiresAt: '',
      },
      onRequestMatch,
    });

    render(<>{node}</>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onRequestMatch).not.toHaveBeenCalled();
  });

  it('disabled 상태에서 클릭 시 onDisabledClick을 호출한다', () => {
    const onRequestMatch = vi.fn();
    const onDisabledClick = vi.fn();
    const node = buildProfileDetailFooter({
      disabled: true,
      onDisabledClick,
      onRequestMatch,
    });

    render(<>{node}</>);
    fireEvent.click(screen.getByRole('button'));
    expect(onDisabledClick).toHaveBeenCalled();
    expect(onRequestMatch).not.toHaveBeenCalled();
  });

  it('기본 상태에서 "매칭 요청" 버튼을 렌더링하고 클릭 시 onRequestMatch를 호출한다', () => {
    const onRequestMatch = vi.fn();
    const node = buildProfileDetailFooter({ onRequestMatch });

    render(<>{node}</>);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('매칭 요청');
    fireEvent.click(button);
    expect(onRequestMatch).toHaveBeenCalled();
  });
});
