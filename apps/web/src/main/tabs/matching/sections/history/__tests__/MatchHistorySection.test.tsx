import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createMatchHistoryResponse,
  createPublicProfileFull,
} from '@/test/home-profile-detail-fixtures';
import { MatchingApiError } from '../../../api/matching.api';
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

    const archiveSummary = screen.getByRole('complementary', { name: '전체 시즌 요약' });
    expect(archiveSummary).not.toHaveTextContent('결과를 모아봤어요');
    expect(archiveSummary).toHaveTextContent('참여 시즌1');
    expect(archiveSummary).toHaveTextContent('매칭 완료1');
    expect(archiveSummary).toHaveTextContent('매칭 미성사0');
    expect(archiveSummary).not.toHaveTextContent('보낸 요청');
    expect(archiveSummary).not.toHaveTextContent('받은 요청');
    expect(archiveSummary).not.toHaveTextContent('종료 event');

    const accordion = screen.getByRole('button', { name: /2026년 1학기/ });
    expect(within(accordion).getByText('받은 요청').parentElement).toHaveTextContent('1명');
    expect(within(accordion).getByText('보낸 요청').parentElement).toHaveTextContent('2명');
    expect(within(accordion).getByText('대화한 상대').parentElement).toHaveTextContent('—');
    expect(accordion).toHaveAttribute('aria-expanded', 'false');
    await user.click(accordion);
    expect(accordion).toHaveAttribute('aria-expanded', 'true');
    const seasonHistory = screen.getByRole('region', { name: /2026년 1학기/ });
    expect(
      within(seasonHistory).getByRole('list', { name: /2026년 1학기 활동 이력/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /매칭 상대.*감자친구.*상대 시즌 프로필/ }),
    ).toBeInTheDocument();
    expect(within(seasonHistory).getByText('매칭 관계')).toBeInTheDocument();
    expect(within(seasonHistory).getByText('최종 상태')).toBeInTheDocument();
    expect(within(seasonHistory).getByText('시즌 종료까지 유지')).toBeInTheDocument();
    expect(within(seasonHistory).getByText('매칭 후 해제')).toBeInTheDocument();
    expect(within(seasonHistory).getByText('매칭 해제 · 감자친구')).toBeInTheDocument();
    expect(
      within(seasonHistory).queryByText('두 사람의 동의로 매칭이 해제되었어요.'),
    ).not.toBeInTheDocument();
    expect(within(seasonHistory).getAllByText('감자친구')).not.toHaveLength(0);
    expect(within(seasonHistory).getByText('2026. 8. 6.')).toBeInTheDocument();
    expect(within(seasonHistory).queryByText(/내가 보낸 요청 · 해제일/)).not.toBeInTheDocument();
  });

  it('chat owner 통계를 seasonId로 결합하고 최종 매칭이 없으면 같은 미성사 pill로 요약한다', () => {
    const base = createMatchHistoryResponse().items[0]!;
    render(
      <MatchHistorySection
        data={{
          items: [
            {
              ...base,
              seasonId: 'season-no-match',
              seasonName: '2026년 1학기',
              finalResult: 'NO_MATCH',
            },
            {
              ...base,
              seasonId: 'season-unmatched',
              seasonName: '2025년 2학기',
              finalResult: 'UNMATCHED_AFTER_SUCCESS',
            },
          ],
        }}
        conversationStats={{
          current: null,
          past: [
            {
              seasonId: 'season-no-match',
              seasonName: '2026년 1학기',
              conversationUserCount: 4,
            },
          ],
        }}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getAllByText('매칭 미성사')).toHaveLength(3);
    expect(screen.queryByText('매칭 후 해제')).not.toBeInTheDocument();
    const firstSeason = screen.getByRole('button', { name: /2026년 1학기/ });
    expect(within(firstSeason).getByText('대화한 상대').parentElement).toHaveTextContent('4명');
    expect(within(firstSeason).getByText('매칭 미성사')).toHaveClass(
      'bg-slate-100',
      'text-slate-700',
    );
    const secondSeason = screen.getByRole('button', { name: /2025년 2학기/ });
    expect(within(secondSeason).getByText('매칭 미성사')).toHaveClass(
      'bg-slate-100',
      'text-slate-700',
    );
    expect(
      within(screen.getByRole('complementary')).getByText('매칭 미성사').parentElement,
    ).toHaveClass('bg-slate-100', 'text-slate-700');
  });

  it('RoommateTab 상세 모달을 재사용해 저장된 score snapshot을 표시한다', async () => {
    const user = userEvent.setup();
    const detailClient = {
      getHistoryCounterpartProfile: vi.fn().mockResolvedValue(
        createPublicProfileFull({
          resultRead: { resultReadable: true, context: 'PAST_MATCH_HISTORY' },
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
            unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
          },
          matchScore: 92,
        }),
      ),
    };
    render(
      <MatchHistorySection
        data={createMatchHistoryResponse()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        detailClient={detailClient}
      />,
    );

    await user.click(screen.getByRole('button', { name: /2026년 1학기/ }));
    await user.click(screen.getByRole('button', { name: /매칭 상대.*감자친구.*상대 시즌 프로필/ }));

    expect(await screen.findByRole('dialog', { name: '상대 시즌 프로필' })).toBeInTheDocument();
    expect(screen.getByText('프로필 기본 정보')).toBeInTheDocument();
    expect(await screen.findByText('매칭도 92점')).toBeInTheDocument();
    expect(screen.getByText('저장된 매칭 결과')).toBeInTheDocument();
    expect(screen.getByText('2026년 1학기 프로필 기준이에요.')).toBeInTheDocument();
    expect(detailClient.getHistoryCounterpartProfile).toHaveBeenCalledWith(
      'history-entry-1',
      expect.any(AbortSignal),
    );
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
    const emptyState = screen.getByRole('status', { name: '아직 지난 매칭 기록이 없어요' });
    expect(emptyState).toHaveTextContent('아직 지난 매칭 기록이 없어요');
    expect(emptyState).toHaveTextContent('이전에 참여한 시즌의 매칭 활동 이력을 확인할 수 있어요.');
    expect(emptyState).not.toHaveTextContent('요청 결과');
    expect(emptyState).not.toHaveTextContent('최종 매칭');

    rerender(
      <MatchHistorySection data={{ items }} loading={false} error={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /이전 시즌 1개 더 보기/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /이전 시즌 1개 더 보기/ }));
    expect(screen.getByRole('button', { name: /4번째 시즌/ })).toBeInTheDocument();
  });

  it('정책상 unavailable인 과거 상세는 Roommate modal 안에서 재시도를 만들지 않는다', async () => {
    const user = userEvent.setup();
    const detailClient = {
      getHistoryCounterpartProfile: vi
        .fn()
        .mockRejectedValue(new MatchingApiError('MATCHING_HISTORY_DETAIL_UNAVAILABLE', 404)),
    };
    render(
      <MatchHistorySection
        data={createMatchHistoryResponse()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        detailClient={detailClient}
      />,
    );

    await user.click(screen.getByRole('button', { name: /2026년 1학기/ }));
    await user.click(screen.getByRole('button', { name: /매칭 상대.*감자친구.*상대 시즌 프로필/ }));

    const dialog = await screen.findByRole('dialog', { name: '상대 시즌 프로필' });
    expect(dialog).toHaveTextContent('과거 상대 프로필을 확인할 수 없어요.');
    expect(dialog).toHaveTextContent('정책상 더 이상 상세 정보를 제공하지 않아요.');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '목록 새로고침' })).not.toBeInTheDocument();
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
    render(
      <div style={{ width: 320 }}>
        <MatchHistorySection data={data} loading={false} error={null} onRetry={vi.fn()} />
      </div>,
    );

    const accordion = screen.getByRole('button', { name: /아주 긴 기숙사/ });
    expect(screen.getByText(data.items[0]!.seasonName)).toBeInTheDocument();
    await user.click(accordion);
    expect(
      screen.getAllByText('여러 줄로 자연스럽게 표시되어야 하는 아주 긴 상대 닉네임'),
    ).not.toHaveLength(0);
    expect(screen.getByTestId('matching-history-section')).toHaveAttribute(
      'data-design-source',
      'legacy-pair',
    );
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
    await user.click(screen.getByRole('button', { name: /매칭 상대.*감자친구.*상대 시즌 프로필/ }));
    expect(await screen.findByRole('dialog', { name: '상대 시즌 프로필' })).toBeInTheDocument();

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
