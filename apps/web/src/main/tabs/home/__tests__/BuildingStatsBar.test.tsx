import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { BuildingStatsBar } from '../BuildingStatsBar';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function setClipboardWriteText(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

describe('BuildingStatsBar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('링크 복사 권한 거부/브라우저 실패를 사용자용 오류 toast로 처리한다', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {
      throw new Error('raw clipboard permission denied');
    });
    setClipboardWriteText(writeText);

    render(
      <BuildingStatsBar
        seasonState="OFF_SEASON"
        hasBuilding={false}
        totalCount={12}
        buildingCount={0}
        todayNewTotal={0}
        todayNewBuilding={0}
        matchSuccessCount={3}
      />,
    );

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(writeText).toHaveBeenCalledWith(window.location.origin);
    expect(toast.error).toHaveBeenCalledWith('링크 복사에 실패했어요');
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('raw clipboard'));
  });
});
