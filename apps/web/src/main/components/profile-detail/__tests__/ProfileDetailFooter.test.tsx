import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildProfileDetailFooter } from '../ProfileDetailFooter';

describe('buildProfileDetailFooter', () => {
  it('hideMatchButton이 true이면 undefined를 반환한다', () => {
    const result = buildProfileDetailFooter({
      hideMatchButton: true,
      onRequestMatch: vi.fn(),
    });
    expect(result).toBeUndefined();
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
