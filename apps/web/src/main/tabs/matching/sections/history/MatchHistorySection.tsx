'use client';

import { useRef, useState } from 'react';
import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import type { MatchingApiError } from '../../api/matching.api';
import { useMatchHistoryCounterpartDetail } from '../../hooks/useMatchHistoryCounterpartDetail';
import {
  getVisibleHistorySeasonCount,
  MATCH_HISTORY_SEASONS_PER_PAGE,
  toMatchingHistoryView,
} from '../../model/matching-history-view';
import { HistoryEntryDialog } from './HistoryEntryDialog';

export function MatchHistorySection({
  data,
  loading,
  error,
  onRetry,
}: {
  readonly data: MatchHistoryResponse | null;
  readonly loading: boolean;
  readonly error: MatchingApiError | null;
  readonly onRetry: () => void;
}) {
  const [pages, setPages] = useState(1);
  const [expandedSeasonIds, setExpandedSeasonIds] = useState<ReadonlySet<string>>(() => new Set());
  const detail = useMatchHistoryCounterpartDetail();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const fallbackSeasonButtonIdRef = useRef<string | null>(null);
  const seasons = data ? toMatchingHistoryView(data) : [];
  const visibleCount = getVisibleHistorySeasonCount(seasons.length, pages);
  const visibleSeasons = seasons.slice(0, visibleCount);

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasonIds((current) => {
      const next = new Set(current);
      if (next.has(seasonId)) next.delete(seasonId);
      else next.add(seasonId);
      return next;
    });
  };

  const closeDetail = () => {
    detail.close();
    const trigger = triggerRef.current;
    triggerRef.current = null;
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus();
      else {
        const fallback = fallbackSeasonButtonIdRef.current
          ? document.getElementById(fallbackSeasonButtonIdRef.current)
          : null;
        (fallback ?? document.getElementById('matching-tab-heading'))?.focus();
      }
    });
  };

  return (
    <section
      id="matching-section-panel-past"
      role="tabpanel"
      aria-labelledby="matching-section-tab-past"
      aria-busy={loading || undefined}
      className="rounded-3xl border border-(--knu-border) bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-(--knu-primary)">지난 시즌</p>
        <h2
          id="matching-history-heading"
          tabIndex={-1}
          className="mt-1 text-xl font-bold text-(--knu-text-primary) outline-none"
        >
          매칭 기록
        </h2>
        <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">
          이전 시즌의 요청과 최종 매칭 결과를 확인할 수 있어요.
        </p>
      </div>

      {loading ? (
        <p role="status" className="mt-6 text-sm text-(--knu-text-secondary)">
          지난 매칭 기록을 불러오는 중이에요.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          <p>지난 매칭 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold"
            onClick={onRetry}
          >
            다시 시도
          </button>
        </div>
      ) : null}
      {!loading && !error && data && seasons.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-(--knu-background-alt) p-4 text-sm leading-6 text-(--knu-text-secondary)">
          확인할 지난 시즌 매칭 기록이 없어요.
        </p>
      ) : null}
      {!loading && !error && data ? (
        <div className="mt-6 space-y-3">
          {visibleSeasons.map((season) => {
            const expanded = expandedSeasonIds.has(season.id);
            const buttonId = `matching-history-season-${season.id}`;
            const panelId = `${buttonId}-panel`;
            return (
              <div
                key={season.id}
                className="overflow-hidden rounded-2xl border border-(--knu-border)"
              >
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-(--knu-background-alt) focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--knu-primary)"
                  onClick={() => toggleSeason(season.id)}
                >
                  <span className="min-w-0">
                    <span className="block wrap-break-word font-semibold text-(--knu-text-primary)">
                      {season.name}
                    </span>
                    <span className="mt-1 block wrap-break-word text-xs leading-5 text-(--knu-text-secondary)">
                      {season.summary}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-(--knu-primary)">
                    {season.resultLabel}
                  </span>
                </button>
                {expanded ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="border-t border-(--knu-border) p-4"
                  >
                    {season.entries.length === 0 ? (
                      <p className="text-sm text-(--knu-text-secondary)">
                        이 시즌의 세부 기록이 없어요.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {season.entries.map((entry) => (
                          <li key={entry.id} className="rounded-2xl bg-(--knu-background-alt) p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="wrap-break-word font-semibold text-(--knu-text-primary)">
                                  {entry.nickname}
                                </p>
                                <p className="mt-1 wrap-break-word text-xs leading-5 text-(--knu-text-tertiary)">
                                  {entry.stageLabel} · {entry.directionLabel} · {entry.eventLabel}{' '}
                                  {entry.eventDateLabel}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-(--knu-primary)">
                                {entry.resultLabel}
                              </span>
                            </div>
                            <p className="mt-3 wrap-break-word text-sm leading-6 text-(--knu-text-secondary)">
                              {entry.description}
                            </p>
                            {entry.canOpenDetail ? (
                              <button
                                type="button"
                                className="mt-3 min-h-11 rounded-xl px-3 text-sm font-semibold text-(--knu-primary) underline underline-offset-4"
                                onClick={(event) => {
                                  triggerRef.current = event.currentTarget;
                                  fallbackSeasonButtonIdRef.current = buttonId;
                                  detail.open(entry.id);
                                }}
                              >
                                당시 상대 프로필 보기
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {visibleCount < seasons.length ? (
            <button
              type="button"
              className="min-h-11 w-full rounded-2xl border border-(--knu-border) px-4 py-2 text-sm font-semibold text-(--knu-primary)"
              onClick={() => setPages((current) => current + 1)}
            >
              이전 시즌 {Math.min(MATCH_HISTORY_SEASONS_PER_PAGE, seasons.length - visibleCount)}개
              더 보기
            </button>
          ) : null}
        </div>
      ) : null}
      <HistoryEntryDialog state={detail} onClose={closeDetail} onRetry={detail.retry} />
    </section>
  );
}
