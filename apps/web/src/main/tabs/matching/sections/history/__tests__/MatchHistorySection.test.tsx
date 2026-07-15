import { render, screen, waitFor } from '@testing-library/react';
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

  it('긴 한글 season/result/summary copy를 320px에서도 wrap 가능한 DOM으로 유지한다', async () => {
    const user = userEvent.setup();
    const base = createMatchHistoryResponse().items[0]!;
    const data = {
      items: [
        {
          ...base,
          seasonName: '2026년 1학기 아주 긴 기숙사 배정 및 매칭 결과 확인 시즌',
          history: [
            {
              ...base.history[0]!,
              counterpartNickname: '여러 줄로 자연스럽게 표시되어야 하는 아주 긴 상대 닉네임',
            },
          ],
        },
      ],
    };
    const { container } = render(
      <div style={{ width: 320 }}>
        <MatchHistorySection data={data} loading={false} error={null} onRetry={vi.fn()} />
      </div>,
    );

    const accordion = screen.getByRole('button', { name: /아주 긴 기숙사/ });
    expect(accordion.querySelector('span')).toHaveClass('min-w-0');
    expect(screen.getByText(data.items[0]!.seasonName)).toHaveClass('wrap-break-word');
    await user.click(accordion);
    expect(screen.getByText(data.items[0]!.history[0]!.counterpartNickname)).toHaveClass(
      'wrap-break-word',
    );
    expect(container.querySelector('section')).toHaveClass('p-5', 'sm:p-6');
  });

  it('상세 trigger가 사라진 뒤 close하면 owning season accordion으로 focus를 복원한다', async () => {
    const user = userEvent.setup();
    const base = createMatchHistoryResponse().items[0]!;
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: 'user-2',
        detailState: 'TOMBSTONE',
        relation: { type: 'MATCHED_PARTNER' },
        exposure: {
          listSummaryVisible: false,
          detailViewable: false,
          canViewFull: false,
          scoreVisible: false,
        },
        actions: {
          canBookmark: false,
          canRequestMatch: false,
          canStartChat: false,
          unavailableReasons: [],
        },
        resultRead: { resultReadable: true, context: 'PAST_MATCH_HISTORY' },
        tombstone: {
          reason: 'DETAIL_CONTEXT_NO_LONGER_VALID',
          displayName: '상대 프로필',
          message: '현재는 확인할 수 없어요.',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(
      <>
        <h1 id="matching-tab-heading" tabIndex={-1}>
          매칭 현황
        </h1>
        <MatchHistorySection
          data={{ items: [base] }}
          loading={false}
          error={null}
          onRetry={vi.fn()}
        />
      </>,
    );

    const accordion = screen.getByRole('button', { name: /2026년 1학기/ });
    await user.click(accordion);
    await user.click(screen.getByRole('button', { name: '당시 상대 프로필 보기' }));
    expect(
      await screen.findByRole('dialog', { name: '과거 매칭 상대 프로필' }),
    ).toBeInTheDocument();

    rerender(
      <>
        <h1 id="matching-tab-heading" tabIndex={-1}>
          매칭 현황
        </h1>
        <MatchHistorySection
          data={{
            items: [
              {
                ...base,
                history: [{ ...base.history[0]!, result: 'UNMATCHED_AFTER_SUCCESS' }],
              },
            ],
          }}
          loading={false}
          error={null}
          onRetry={vi.fn()}
        />
      </>,
    );
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(accordion).toHaveFocus());
  });
});
