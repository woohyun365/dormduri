import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Building2, UserRound } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeResponsiveDialog } from '../overlays/HomeResponsiveDialog';
import { HomeResponsiveSheet } from '../overlays/HomeResponsiveSheet';

function SheetFixture({ onClose }: { onClose: () => void }) {
  return (
    <HomeResponsiveSheet
      eyebrow="시즌 오픈"
      title="운영 기숙사 리스트"
      description={'이번 시즌에 선택할 수 있는 기숙사예요.\n호실 선택 기준일도 함께 확인해요.'}
      icon={Building2}
      onClose={onClose}
      footer={<button type="button">확인</button>}
    >
      <button type="button">첫 번째 항목</button>
      <button type="button">마지막 항목</button>
    </HomeResponsiveSheet>
  );
}

function DialogFixture({ onClose }: { onClose: () => void }) {
  return (
    <HomeResponsiveDialog
      label="상대 프로필"
      eyebrow="매칭 상대 프로필"
      title="민지님"
      description="현재 확정된 매칭 상대의 시즌 프로필을 확인해요."
      icon={UserRound}
      onClose={onClose}
      footer={<button type="button">확인했어요</button>}
    >
      <button type="button">상대 정보</button>
      <button type="button">읽기 전용 안내</button>
    </HomeResponsiveDialog>
  );
}

describe('Home responsive overlay primitives', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('HomeResponsiveSheet가 dialog semantics, body scroll lock, backdrop close를 공통 제공한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SheetFixture onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: '운영 기숙사 리스트' })).toBeInTheDocument();
    expect(screen.getByText('시즌 오픈')).toBeInTheDocument();
    expect(screen.getByText(/호실 선택 기준일도 함께 확인해요/)).toBeInTheDocument();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: '운영 기숙사 리스트 닫기' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('HomeResponsiveDialog가 ESC close, focus trap, focus restore를 공통 제공한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<button type="button">오버레이 열기</button>);

    const opener = screen.getByRole('button', { name: '오버레이 열기' });
    opener.focus();

    rerender(
      <>
        <button type="button">오버레이 열기</button>
        <DialogFixture onClose={onClose} />
      </>,
    );

    const dialog = screen.getByRole('dialog', { name: '상대 프로필' });
    await waitFor(() => expect(dialog).toHaveFocus());

    screen.getByRole('button', { name: '닫기' }).focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: '확인했어요' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<button type="button">오버레이 열기</button>);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '오버레이 열기' })).toHaveFocus(),
    );
  });

  it('overlay unmount 시 body scroll lock을 원래 상태로 복원한다', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<DialogFixture onClose={onClose} />);

    expect(document.body.style.position).toBe('fixed');
    expect(document.documentElement.style.overflow).toBe('hidden');

    rerender(<div />);

    await waitFor(() => expect(document.body.style.position).toBe(''));
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
