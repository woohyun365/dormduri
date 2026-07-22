'use client';

import { type ReactNode, useRef, useState } from 'react';
import type { ConversationStatsResponse } from '@repo/shared/chat';
import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import {
  Archive,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CircleMinus,
  History,
  Inbox,
  MessageCircle,
  Send,
  ShieldCheck,
  UserRound,
  UserRoundSearch,
} from 'lucide-react';
import type { MatchingApiError } from '../../api/matching.api';
import {
  MatchingActivityLedger,
  type MatchingActivityLedgerItem,
} from '../../components/pair/MatchingActivityLedger';
import {
  type MatchHistoryCounterpartDetailClient,
  useMatchHistoryCounterpartDetail,
} from '../../hooks/useMatchHistoryCounterpartDetail';
import {
  type MatchHistorySelfProfileClient,
  useMatchHistorySelfProfile,
} from '../../hooks/useMatchHistorySelfProfile';
import {
  getVisibleHistorySeasonCount,
  MATCH_HISTORY_SEASONS_PER_PAGE,
  type MatchingHistoryEntryView,
  type MatchingHistorySeasonView,
  toMatchingHistoryView,
} from '../../model/matching-history-view';
import { HistoryEntryDialog } from './HistoryEntryDialog';
import { HistorySelfProfileDialog } from './HistorySelfProfileDialog';

export function MatchHistorySection({
  data,
  loading,
  error,
  onRetry,
  detailClient,
  selfProfileClient,
  conversationStats = null,
}: {
  readonly data: MatchHistoryResponse | null;
  readonly loading: boolean;
  readonly error: MatchingApiError | null;
  readonly onRetry: () => void;
  readonly detailClient?: MatchHistoryCounterpartDetailClient;
  readonly selfProfileClient?: MatchHistorySelfProfileClient;
  readonly conversationStats?: ConversationStatsResponse | null;
}) {
  const [pages, setPages] = useState(1);
  const [expandedSeasonIds, setExpandedSeasonIds] = useState<ReadonlySet<string>>(() => new Set());
  const detail = useMatchHistoryCounterpartDetail({ client: detailClient });
  const selfProfile = useMatchHistorySelfProfile({ client: selfProfileClient });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selfProfileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const fallbackSeasonButtonIdRef = useRef<string | null>(null);
  const seasons = data ? toMatchingHistoryView(data, conversationStats) : [];
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
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else {
        const fallback = fallbackSeasonButtonIdRef.current
          ? document.getElementById(fallbackSeasonButtonIdRef.current)
          : null;
        (fallback ?? document.getElementById('matching-tab-heading'))?.focus({
          preventScroll: true,
        });
      }
    });
  };

  const closeSelfProfile = () => {
    selfProfile.close();
    const trigger = selfProfileTriggerRef.current;
    selfProfileTriggerRef.current = null;
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else document.getElementById('matching-tab-heading')?.focus({ preventScroll: true });
    });
  };

  return (
    <section
      id="matching-section-panel-past"
      role="tabpanel"
      aria-labelledby="matching-section-tab-past"
      aria-busy={loading || undefined}
      data-testid="matching-history-section"
      data-design-source="legacy-pair"
      className="space-y-3"
    >
      <h2 id="matching-history-heading" tabIndex={-1} className="sr-only">
        매칭 기록
      </h2>

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
      {!loading && !error && data && seasons.length === 0 ? <HistoryEmptyState /> : null}
      {!loading && !error && data && seasons.length > 0 ? (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
          <aside
            aria-labelledby="matching-history-overview-heading"
            className="order-first rounded-2xl border-2 border-[var(--knu-border)] bg-white p-5 shadow-sm md:order-last"
          >
            <HistoryArchiveSummary seasons={seasons} />
          </aside>
          <div aria-label="시즌별 매칭 기록" className="min-w-0 space-y-3">
            {visibleSeasons.map((season) => {
              const expanded = expandedSeasonIds.has(season.id);
              const buttonId = `matching-history-season-${season.id}`;
              const panelId = `${buttonId}-panel`;
              const seasonPresentation = getSeasonPresentation(season.result);
              const matchedEntry =
                season.result === 'MATCHED_SUCCESS'
                  ? season.entries.find(
                      (entry) => entry.stage === 'MATCH' && entry.result === 'MATCHED_SUCCESS',
                    )
                  : undefined;
              const relationshipEntry = matchedEntry;
              const activityItems = groupHistoryActivityEntries(season.entries);
              return (
                <div
                  key={season.id}
                  className={`overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition-shadow hover:shadow-md ${seasonPresentation.containerClassName}`}
                >
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="w-full px-5 py-5 text-left outline-none transition-colors hover:bg-[var(--knu-background-alt)]/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--knu-primary)"
                    onClick={() => toggleSeason(season.id)}
                  >
                    <span className="block min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[1.05rem] font-black text-(--knu-text-primary)">
                          {season.name}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${seasonPresentation.badgeClassName}`}
                        >
                          {seasonPresentation.icon}
                          {season.resultLabel}
                        </span>
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2 pl-1">
                        <span className="text-xs font-bold text-(--knu-text-tertiary)">
                          지난 시즌
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-5 w-5 shrink-0 text-[var(--knu-text-tertiary)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      </span>
                    </span>
                    <span className="mt-4 grid grid-cols-3 gap-2">
                      <HistorySummaryStat
                        icon={<Inbox className="h-4 w-4 text-purple-600" />}
                        label="받은 요청"
                        value={season.receivedRequestCount}
                        unit="명"
                        tone="purple"
                      />
                      <HistorySummaryStat
                        icon={<Send className="h-4 w-4 text-blue-600" />}
                        label="보낸 요청"
                        value={season.sentRequestCount}
                        unit="명"
                        tone="blue"
                      />
                      <HistorySummaryStat
                        icon={<MessageCircle className="h-4 w-4 text-green-600" />}
                        label="대화한 상대"
                        value={season.conversationUserCount}
                        unit="명"
                        tone="emerald"
                      />
                    </span>
                  </button>
                  {expanded ? (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="space-y-5 border-t-2 border-[var(--knu-border)] bg-slate-50/60 px-5 py-5"
                    >
                      <HistoryProfileActionDeck
                        seasonName={season.name}
                        matchedEntry={matchedEntry}
                        onOpenSelf={(trigger) => {
                          selfProfileTriggerRef.current = trigger;
                          selfProfile.open({ seasonId: season.id, seasonName: season.name });
                        }}
                        onOpenCounterpart={(entry, trigger) => {
                          triggerRef.current = trigger;
                          fallbackSeasonButtonIdRef.current = buttonId;
                          detail.open({
                            entryId: entry.id,
                            nickname: entry.nickname,
                            seasonName: season.name,
                          });
                        }}
                      />
                      {relationshipEntry ? (
                        <HistoryRelationshipSummary entry={relationshipEntry} />
                      ) : null}
                      {season.entries.length === 0 ? (
                        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-(--knu-text-secondary)">
                          이 시즌의 세부 기록이 없어요.
                        </p>
                      ) : activityItems.length > 0 ? (
                        <section aria-labelledby={`${panelId}-activity-heading`}>
                          <div className="mb-3 flex items-center gap-2">
                            <History className="h-4 w-4 text-slate-500" aria-hidden />
                            <h3
                              id={`${panelId}-activity-heading`}
                              className="text-sm font-bold text-(--knu-text-primary)"
                            >
                              활동 이력
                            </h3>
                          </div>
                          <MatchingActivityLedger
                            items={toHistoryActivityLedgerItems(activityItems)}
                            ariaLabel={`${season.name} 활동 이력`}
                          />
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {visibleCount < seasons.length ? (
              <button
                type="button"
                className="min-h-11 w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100"
                onClick={() => setPages((current) => current + 1)}
              >
                이전 시즌 {Math.min(MATCH_HISTORY_SEASONS_PER_PAGE, seasons.length - visibleCount)}
                개 더 보기
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <HistoryEntryDialog state={detail} onClose={closeDetail} onRetry={detail.retry} />
      <HistorySelfProfileDialog
        state={selfProfile}
        onClose={closeSelfProfile}
        onRetry={selfProfile.retry}
      />
    </section>
  );
}

function getSeasonPresentation(result: MatchingHistorySeasonView['result']) {
  switch (result) {
    case 'MATCHED_SUCCESS':
      return {
        containerClassName: 'border-[var(--knu-border)]',
        badgeClassName: 'bg-emerald-50 text-emerald-700',
        iconBlockClassName: 'bg-emerald-100 text-emerald-700',
        icon: <CheckCircle className="h-3.5 w-3.5" aria-hidden />,
      };
    case 'UNMATCHED_AFTER_SUCCESS':
    case 'NO_MATCH':
      return {
        containerClassName: 'border-[var(--knu-border)]',
        badgeClassName: 'bg-slate-100 text-slate-700',
        iconBlockClassName: 'bg-slate-100 text-slate-700',
        icon: <CircleMinus className="h-3.5 w-3.5" aria-hidden />,
      };
  }
}

type HistoryActivityItem =
  | { readonly id: string; readonly kind: 'entry'; readonly entry: MatchingHistoryEntryView }
  | {
      readonly id: string;
      readonly kind: 'auto-closed-group';
      readonly cause:
        | 'VIEWER_MATCHED'
        | 'COUNTERPART_MATCHED'
        | 'PARTICIPATION_CANCELLED'
        | 'PRECONDITION_FAILED';
      readonly entries: readonly MatchingHistoryEntryView[];
    };

function groupHistoryActivityEntries(
  entries: readonly MatchingHistoryEntryView[],
): readonly HistoryActivityItem[] {
  const viewerAutoClosedByGroup = new Map<string, MatchingHistoryEntryView[]>();
  entries.forEach((entry) => {
    if (entry.systemCancellationCause !== 'VIEWER_MATCHED' || !entry.systemCancellationGroupId) {
      return;
    }
    const group = viewerAutoClosedByGroup.get(entry.systemCancellationGroupId) ?? [];
    group.push(entry);
    viewerAutoClosedByGroup.set(entry.systemCancellationGroupId, group);
  });

  const emittedGroupIds = new Set<string>();
  const items = entries.flatMap<HistoryActivityItem>((entry): HistoryActivityItem[] => {
    if (entry.systemCancellationCause === 'COUNTERPART_MATCHED') {
      return [
        {
          id: `counterpart-auto-closed:${entry.id}`,
          kind: 'auto-closed-group',
          cause: 'COUNTERPART_MATCHED',
          entries: [entry],
        },
      ];
    }
    if (entry.requestTerminalReason === 'WITHDRAWN_PARTICIPANT') {
      return [
        {
          id: `participation-auto-closed:${entry.id}`,
          kind: 'auto-closed-group',
          cause: 'PARTICIPATION_CANCELLED',
          entries: [entry],
        },
      ];
    }
    if (entry.requestTerminalReason === 'MATCH_PRECONDITION_FAILED') {
      return [
        {
          id: `precondition-auto-closed:${entry.id}`,
          kind: 'auto-closed-group',
          cause: 'PRECONDITION_FAILED',
          entries: [entry],
        },
      ];
    }
    if (entry.systemCancellationCause !== 'VIEWER_MATCHED' || !entry.systemCancellationGroupId) {
      return [{ id: entry.id, kind: 'entry', entry }];
    }
    if (emittedGroupIds.has(entry.systemCancellationGroupId)) return [];
    emittedGroupIds.add(entry.systemCancellationGroupId);
    const group = viewerAutoClosedByGroup.get(entry.systemCancellationGroupId) ?? [entry];
    return [
      {
        id: `viewer-auto-closed:${entry.systemCancellationGroupId}`,
        kind: 'auto-closed-group',
        cause: 'VIEWER_MATCHED',
        entries: group,
      },
    ];
  });

  return items.toSorted((left, right) => {
    const timeDifference = historyActivityTimestamp(left) - historyActivityTimestamp(right);
    if (timeDifference !== 0) return timeDifference;
    return historyActivityPriority(left) - historyActivityPriority(right);
  });
}

function historyActivityTimestamp(item: HistoryActivityItem): number {
  const eventAt = item.kind === 'entry' ? item.entry.eventAt : item.entries[0]?.eventAt;
  const timestamp = eventAt ? new Date(eventAt).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function historyActivityPriority(item: HistoryActivityItem): number {
  if (item.kind === 'entry' && item.entry.stage === 'MATCH') return 0;
  if (item.kind === 'auto-closed-group') return 1;
  return 2;
}

function HistoryProfileActionDeck({
  seasonName,
  matchedEntry,
  onOpenSelf,
  onOpenCounterpart,
}: {
  readonly seasonName: string;
  readonly matchedEntry?: MatchingHistoryEntryView;
  readonly onOpenSelf: (trigger: HTMLButtonElement) => void;
  readonly onOpenCounterpart: (entry: MatchingHistoryEntryView, trigger: HTMLButtonElement) => void;
}) {
  return (
    <section aria-label="시즌 프로필 바로가기" className="grid gap-2 sm:grid-cols-2">
      <ProfileActionTile
        icon={<UserRound className="h-5 w-5" aria-hidden />}
        eyebrow="나"
        title="해당 시즌 프로필"
        subtitle={`${seasonName} 등록 정보`}
        tone="blue"
        onClick={onOpenSelf}
      />
      {matchedEntry ? (
        <ProfileActionTile
          icon={<UserRoundSearch className="h-5 w-5" aria-hidden />}
          eyebrow="매칭 상대"
          title={matchedEntry.nickname}
          subtitle="상대 시즌 프로필"
          tone="emerald"
          onClick={(trigger) => onOpenCounterpart(matchedEntry, trigger)}
        />
      ) : (
        <div
          aria-label="매칭 상대 매칭 미성사"
          className="hidden min-h-20 w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-500 sm:flex"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
            <UserRoundSearch className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold">매칭 상대</span>
            <span className="mt-0.5 block truncate text-sm font-black text-slate-600">
              매칭 미성사
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              상대 시즌 프로필 없음
            </span>
          </span>
        </div>
      )}
    </section>
  );
}

function ProfileActionTile({
  icon,
  eyebrow,
  title,
  subtitle,
  tone,
  onClick,
}: {
  readonly icon: ReactNode;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tone: 'blue' | 'emerald';
  readonly onClick: (trigger: HTMLButtonElement) => void;
}) {
  const toneClassName =
    tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-300'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-300';

  return (
    <button
      type="button"
      className={`group flex min-h-20 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--knu-primary) ${toneClassName}`}
      onClick={(event) => onClick(event.currentTarget)}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold">{eyebrow}</span>
        <span className="mt-0.5 block truncate text-sm font-black text-(--knu-text-primary)">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-(--knu-text-secondary)">
          {subtitle}
        </span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function HistoryRelationshipSummary({ entry }: { readonly entry: MatchingHistoryEntryView }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">매칭 관계</p>
          <h3 className="mt-1 text-sm font-black text-(--knu-text-primary)">{entry.nickname}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          매칭 완료
        </span>
      </div>
      <ol className="relative mt-4 grid grid-cols-2 before:absolute before:left-[calc(25%+1.25rem)] before:right-[calc(25%+1.25rem)] before:top-5 before:h-0.5 before:bg-linear-to-r before:from-sky-200 before:via-slate-200 before:to-emerald-200 before:content-['']">
        <li className="relative z-10 min-w-0 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-sky-100 text-sky-700">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 block text-[11px] font-bold text-slate-500">매칭일</span>
          <time className="mt-0.5 block truncate text-sm font-black text-slate-800">
            {entry.matchedAt ? formatHistoryDate(entry.matchedAt) : '날짜 정보 없음'}
          </time>
        </li>
        <li className="relative z-10 min-w-0 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 block text-[11px] font-bold text-emerald-700">최종 상태</span>
          <span className="mx-auto mt-0.5 block max-w-28 break-keep text-xs font-black leading-5 text-emerald-900 sm:max-w-none sm:text-sm">
            시즌 종료까지 유지
          </span>
        </li>
      </ol>
    </section>
  );
}

function toHistoryActivityLedgerItems(
  items: readonly HistoryActivityItem[],
): readonly MatchingActivityLedgerItem[] {
  return items.map((item) =>
    item.kind === 'entry'
      ? {
          id: item.id,
          kind: 'entry',
          entry: {
            id: item.entry.id,
            result: item.entry.result,
            title: item.entry.resultLabel,
            detail: historyActivityDetail(item.entry),
            dateLabel: item.entry.eventDateLabel,
          },
        }
      : {
          id: item.id,
          kind: 'auto-closed-group',
          cause: item.cause,
          dateLabel: item.entries[0]?.eventDateLabel,
          entries: item.entries.map((entry) => ({
            id: entry.id,
            nickname: entry.nickname,
            directionLabel: entry.directionLabel,
          })),
        },
  );
}

function historyActivityDetail(entry: MatchingHistoryEntryView): string {
  if (entry.result === 'UNMATCHED_AFTER_SUCCESS') {
    return `매칭 해제 · ${entry.nickname}`;
  }
  if (entry.systemCancellationCause === 'VIEWER_MATCHED') {
    return '내 매칭 확정으로 정리됐어요.';
  }
  if (entry.systemCancellationCause === 'COUNTERPART_MATCHED') {
    return '상대 매칭 확정으로 정리됐어요.';
  }
  return entry.description ?? `${entry.directionLabel} · ${entry.nickname}`;
}

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록된 날짜';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function HistoryArchiveSummary({
  seasons,
}: {
  readonly seasons: ReturnType<typeof toMatchingHistoryView>;
}) {
  const matchedCount = seasons.filter((season) => season.result === 'MATCHED_SUCCESS').length;
  const unmatchedCount = seasons.length - matchedCount;

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <Archive className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-indigo-700">종료된 시즌</p>
          <h3
            id="matching-history-overview-heading"
            className="mt-1 text-lg font-bold text-(--knu-text-primary)"
          >
            전체 시즌 요약
          </h3>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        <ArchiveMetric
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label="참여 시즌"
          value={seasons.length}
          tone="indigo"
        />
        <ArchiveMetric
          icon={<CheckCircle className="h-4 w-4" aria-hidden />}
          label="매칭 완료"
          value={matchedCount}
          tone="emerald"
        />
        <ArchiveMetric
          icon={<CircleMinus className="h-4 w-4" aria-hidden />}
          label="매칭 미성사"
          value={unmatchedCount}
          tone="slate"
        />
      </dl>
    </div>
  );
}

function ArchiveMetric({
  icon,
  label,
  value,
  tone,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number;
  readonly tone: 'indigo' | 'emerald' | 'slate';
}) {
  const toneClassName = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
  }[tone];

  return (
    <div className={`rounded-xl border px-2 py-3 text-center ${toneClassName}`}>
      <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/80">
        {icon}
      </span>
      <dt className="mt-2 text-[11px] font-medium leading-4">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
    </div>
  );
}

function HistoryEmptyState() {
  return (
    <section
      role="status"
      aria-labelledby="matching-history-empty-heading"
      className="rounded-3xl border border-indigo-100 bg-white px-6 py-8 text-center shadow-sm"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
        <Archive className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-4 text-xs font-bold text-indigo-700">지난 시즌</p>
      <h3
        id="matching-history-empty-heading"
        className="mt-1 text-lg font-bold text-(--knu-text-primary)"
      >
        아직 지난 매칭 기록이 없어요
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-(--knu-text-secondary)">
        이전에 참여한 시즌의 매칭 활동 이력을 확인할 수 있어요.
      </p>
    </section>
  );
}

function HistorySummaryStat({
  icon,
  label,
  value,
  unit,
  tone,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number | null;
  readonly unit: '명';
  readonly tone: 'purple' | 'blue' | 'emerald';
}) {
  const iconTone =
    tone === 'purple' ? 'bg-purple-100' : tone === 'blue' ? 'bg-blue-100' : 'bg-emerald-100';
  const valueTone =
    tone === 'purple' ? 'text-purple-700' : tone === 'blue' ? 'text-blue-700' : 'text-emerald-700';

  return (
    <span className="rounded-xl bg-[var(--knu-background-alt)] px-2 py-2.5 text-center sm:px-3 sm:py-3">
      <span
        className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full sm:mb-2 sm:h-8 sm:w-8 ${iconTone}`}
      >
        {icon}
      </span>
      <strong className={`block text-base leading-none ${valueTone}`}>
        {value ?? '—'}
        {value === null ? null : <span className="ml-0.5 text-[11px]">{unit}</span>}
      </strong>
      <span className="mt-1 block text-[10px] leading-4 text-[var(--knu-text-tertiary)] sm:text-[11px]">
        {label}
      </span>
    </span>
  );
}
