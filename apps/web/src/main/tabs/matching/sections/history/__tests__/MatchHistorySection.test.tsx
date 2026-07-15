import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMatchHistoryResponse } from '@/test/home-profile-detail-fixtures';
import { MatchHistorySection } from '../MatchHistorySection';

describe('MatchHistorySection', () => {
  it('season accordion과 최종 매칭 detail CTA를 정책 범위로 렌더링한다', async () => {
    const user = userEvent.setup();
    const data = createMatchHistoryResponse({
      items: [
        {
          ...createMatchHistoryResponse().items[0]!,
          history: [
            createMatchHistoryResponse().items[0]!.history[0]!,
            {
              ...createMatchHistoryResponse().items[0]!.history[0]!,
              id: 'unmatched',
              result: 'UNMATCHED_AFTER_SUCCESS',
              activeMatchEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
            },
          ],
        },
      ],
    });
    render(<MatchHistorySection data={data} loading={false} error={null} onRetry={vi.fn()} />);

    const accordion = screen.getByRole('button', { name: /2026년 1학기/ });
    expect(accordion).toHaveAttribute('aria-expanded', 'false');
    await user.click(accordion);
    expect(accordion).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /2026년 1학기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '당시 상대 프로필 보기' })).toBeInTheDocument();
    expect(screen.getAllByText('매칭 후 해제')).toHaveLength(1);
    expect(screen.getByText(/내가 보낸 요청 · 해제일/)).toBeInTheDocument();
  });

  it('empty history와 3-season local reveal을 구분한다', async () => {
    const user = userEvent.setup();
    const base = createMatchHistoryResponse().items[0]!;
    const items = Array.from({ length: 4 }, (_, index) => ({
      ...base,
      seasonId: `season-${index}`,
      seasonName: `${index + 1}번째 시즌`,
    }));
    const { rerender } = render(
      <MatchHistorySection data={{ items: [] }} loading={false} error={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByText('확인할 지난 시즌 매칭 기록이 없어요.')).toBeInTheDocument();

    rerender(
      <MatchHistorySection data={{ items }} loading={false} error={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /이전 시즌 1개 더 보기/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /이전 시즌 1개 더 보기/ }));
    expect(screen.getByRole('button', { name: /4번째 시즌/ })).toBeInTheDocument();
  });
});
