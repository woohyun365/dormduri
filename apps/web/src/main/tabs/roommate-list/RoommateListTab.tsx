'use client';

import { RefreshCw, Search } from 'lucide-react';
import { getDormitoryById } from '@/constants/dormitory';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { RoommateListBannerGroup } from './RoommateListBannerGroup';
import { useRoommateSearch, type UseRoommateSearchResult } from './hooks/useRoommateSearch';
import type {
  RoommateSearchScope,
  RoommateSearchSort,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search/contract';
import type { TabId, UserProfile } from '@/types/profile';

const CLOSED_SEARCH_MESSAGE =
  '지금은 룸메이트 찾기 탐색 기간이 아니에요. 이전 매칭 기록은 매칭 현황에서 확인해 주세요.';
const ENTRY_CLOSED_MESSAGE =
  '현재 상태에서는 룸메이트 찾기 탐색을 열 수 없어요. 시즌 참여 상태를 확인해 주세요.';
const LOADING_SEARCH_MESSAGE = '룸메이트 목록을 불러오는 중이에요.';
const EMPTY_SEARCH_MESSAGE = '조건에 맞는 룸메이트가 아직 없어요.';

const SEARCH_SCOPES: readonly RoommateSearchScope[] = ['CAMPUS_MERGED', 'SAME_BUILDING_ONLY'];

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  searchEntryAllowed?: boolean;
}

export default function RoommateListTab({
  user,
  onNavigate,
  searchEntryAllowed = true,
}: RoommateListTabProps) {
  const season = useSeasonContext();
  const closedMessage =
    season.state === 'OFF_SEASON'
      ? CLOSED_SEARCH_MESSAGE
      : searchEntryAllowed
        ? null
        : ENTRY_CLOSED_MESSAGE;
  const searchClosed = closedMessage !== null;
  const search = useRoommateSearch({ autoLoad: !searchClosed });
  const assignedDormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const headerTitle = assignedDormitory ? `${assignedDormitory.name} 룸메이트` : '룸메이트 찾기';
  const isLoading = search.status === 'idle' || search.status.startsWith('loading');

  return (
    <div>
      <section
        role="banner"
        className="sticky top-0 z-40 border-b-2 border-[var(--knu-border)] bg-white px-5 py-4"
      >
        <div className="mx-auto max-w-md space-y-4">
          <div>
            <p className="text-xs font-semibold text-[var(--knu-primary)]">Roommate Search</p>
            <h1 className="text-2xl font-bold text-[var(--knu-text-primary)]">{headerTitle}</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--knu-text-secondary)]">
              시즌 정책에 맞춰 공개 가능한 요약 정보만 보여줘요.
            </p>
          </div>

          {!searchClosed && search.statusMessage ? (
            <p
              role="status"
              className="rounded-2xl bg-[var(--knu-primary-light)] px-4 py-3 text-sm font-semibold text-[var(--knu-primary)]"
            >
              {search.statusMessage}
            </p>
          ) : null}

          {!searchClosed && search.notices.length > 0 ? <NoticeList search={search} /> : null}

          {!searchClosed ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--knu-text-tertiary)]">탐색 범위</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="탐색 범위">
                  {SEARCH_SCOPES.map((scope) => {
                    const active = search.query.scope === scope;
                    const available = isScopeAvailable(search, scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        disabled={isLoading || active || !available}
                        onClick={() => void search.changeScope(scope)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                          active
                            ? 'bg-[var(--knu-primary)] text-white'
                            : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
                        }`}
                      >
                        {scopeLabel(scope)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--knu-text-tertiary)]">정렬</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="정렬">
                  {(search.manifest?.sortOptions ?? [search.query.sort]).map((sort) => {
                    const active = search.query.sort === sort;
                    return (
                      <button
                        key={sort}
                        type="button"
                        disabled={isLoading || active}
                        onClick={() => void search.changeSort(sort)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                          active
                            ? 'bg-[var(--knu-primary)] text-white'
                            : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
                        }`}
                      >
                        {sortLabel(sort)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {search.manifest && !search.manifest.canOpenFilterSheet ? (
                <p className="rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-xs leading-5 text-[var(--knu-text-secondary)]">
                  현재 시즌 정책상 상세 필터는 열리지 않아요.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {!searchClosed ? (
        <RoommateListBannerGroup
          user={user}
          isUnassigned={!assignedDormitory}
          showProfileBanner
          onNavigate={onNavigate}
          filteredProfilesCount={search.items.length}
        />
      ) : null}

      <div className="mx-auto max-w-md px-5 pb-8">{renderSearchBody(search, closedMessage)}</div>
    </div>
  );
}

function renderSearchBody(search: UseRoommateSearchResult, closedMessage: string | null) {
  if (closedMessage) {
    return (
      <section
        role="status"
        className="mt-5 rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm"
      >
        <Search className="mx-auto h-8 w-8 text-[var(--knu-text-tertiary)]" />
        <p className="mt-3 text-sm font-semibold text-[var(--knu-text-primary)]">{closedMessage}</p>
      </section>
    );
  }

  if (search.status === 'error') {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm"
      >
        <p className="text-sm font-semibold text-red-600">
          {search.error?.message ?? '룸메이트 찾기 정보를 불러오지 못했어요.'}
        </p>
        <button
          type="button"
          onClick={() => void search.refresh()}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--knu-primary-dark)]"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
      </section>
    );
  }

  if (search.status === 'idle' || search.status.startsWith('loading')) {
    return (
      <section
        role="status"
        className="rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm"
      >
        <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
          {LOADING_SEARCH_MESSAGE}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
          공개 가능한 요약 정보와 시즌 정책을 확인하고 있어요.
        </p>
      </section>
    );
  }

  const emptyNotice = search.notices.find((notice) => notice.emptyState);

  if (search.items.length === 0) {
    return (
      <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm">
        <Search className="mx-auto h-8 w-8 text-[var(--knu-text-tertiary)]" />
        <p className="mt-3 text-sm font-semibold text-[var(--knu-text-primary)]">
          {emptyNotice?.title ?? EMPTY_SEARCH_MESSAGE}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
          {emptyNotice?.message ?? '탐색 범위나 정렬을 바꿔 다시 확인해 보세요.'}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="룸메이트 검색 결과">
      <ul className="space-y-3">
        {search.items.map((item) => (
          <RoommateSummaryCard key={item.id} item={item} />
        ))}
      </ul>

      {search.canLoadMore ? (
        <button
          type="button"
          onClick={() => void search.loadMore()}
          className="w-full rounded-2xl border-2 border-[var(--knu-border)] bg-white py-3 text-sm font-semibold text-[var(--knu-primary)] transition-all hover:border-[var(--knu-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          더 보기
        </button>
      ) : (
        <p className="py-4 text-center text-sm text-[var(--knu-text-tertiary)]">
          더 이상 표시할 요약 정보가 없어요.
        </p>
      )}
    </section>
  );
}

function NoticeList({ search }: { search: UseRoommateSearchResult }) {
  return (
    <div className="space-y-2" aria-label="룸메이트 찾기 안내">
      {search.notices.map((notice) => (
        <div
          key={`${notice.code}-${notice.title}`}
          aria-live={notice.liveRegion}
          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            notice.severity === 'WARNING'
              ? 'bg-orange-50 text-orange-800'
              : 'bg-[var(--knu-primary-light)] text-[var(--knu-primary)]'
          }`}
        >
          <p className="font-semibold">{notice.title}</p>
          <p className="text-xs opacity-90">{notice.message}</p>
        </div>
      ))}
    </div>
  );
}

function RoommateSummaryCard({ item }: { item: RoommateSearchSummary }) {
  const summary = item.profileSummary;

  return (
    <li>
      <article className="rounded-3xl border border-[var(--knu-border)] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--knu-text-primary)]">{summary.nickname}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--knu-text-secondary)]">
              {summary.intro || '아직 자기소개가 없어요.'}
            </p>
          </div>
          {typeof item.matchScore === 'number' ? (
            <span className="shrink-0 rounded-full bg-[var(--knu-primary-light)] px-3 py-1 text-xs font-bold text-[var(--knu-primary)]">
              적합도 {item.matchScore}점
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 text-xs text-[var(--knu-text-secondary)]">
          <SummaryFact label="흡연" value={lifestyleLabel(summary.smokingBehavior)} />
          <SummaryFact label="잠버릇" value={lifestyleLabel(summary.sleepHabit)} />
          <SummaryFact label="관계" value={lifestyleLabel(summary.relationshipStyle)} />
        </dl>
      </article>
    </li>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[var(--knu-background-alt)] px-3 py-2">
      <dt className="font-semibold text-[var(--knu-text-tertiary)]">{label}</dt>
      <dd className="font-medium text-[var(--knu-text-secondary)]">{value}</dd>
    </div>
  );
}

function isScopeAvailable(search: UseRoommateSearchResult, scope: RoommateSearchScope): boolean {
  const availability = search.response?.scopeAvailability;
  if (!availability) return search.query.scope === scope;
  return scope === 'CAMPUS_MERGED' ? availability.campusMerged : availability.sameBuildingOnly;
}

function scopeLabel(scope: RoommateSearchScope): string {
  return scope === 'CAMPUS_MERGED' ? '캠퍼스 전체' : '같은 건물';
}

function sortLabel(sort: RoommateSearchSort): string {
  return sort === 'MATCH_SCORE' ? '적합도순' : '닉네임순';
}

function lifestyleLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    NO: '비흡연',
    E_CIG: '전자담배',
    YES: '흡연',
    NONE: '없음',
    HAS: '있음',
    CASUAL: '적당한 거리',
    CLOSE: '가까운 관계',
    DISTANT: '각자 생활',
  };
  return labels[value] ?? value;
}
