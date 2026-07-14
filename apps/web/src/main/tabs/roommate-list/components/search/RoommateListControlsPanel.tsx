import { Bookmark, Search } from 'lucide-react';
import type { ReactNode } from 'react';

export function RoommateListControlsPanel({
  showBookmarkedOnly,
  showBookmarkToggle,
  disabled,
  onBookmarkOnlyChange,
  variant,
  children,
}: {
  readonly showBookmarkedOnly: boolean;
  readonly showBookmarkToggle: boolean;
  readonly disabled: boolean;
  readonly onBookmarkOnlyChange: (showBookmarkedOnly: boolean) => void;
  readonly variant: 'mobileControls' | 'desktopAside';
  readonly children: ReactNode;
}) {
  const className =
    variant === 'desktopAside'
      ? 'space-y-4 rounded-3xl border border-(--knu-border) bg-white/80 p-4 shadow-sm'
      : 'space-y-4 rounded-none border-y border-(--knu-border) bg-transparent py-4 shadow-none lg:hidden';

  return (
    <section className={className} aria-label="검색 결과 설정">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <Search className="h-4 w-4 text-(--knu-primary)" aria-hidden />
          <p className="text-sm font-bold text-(--knu-text-primary)">검색 결과</p>
        </div>
        {showBookmarkToggle ? (
          <RoommateBookmarkOnlyToggle
            checked={showBookmarkedOnly}
            disabled={disabled}
            onChange={onBookmarkOnlyChange}
          />
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function RoommateListDesktopAsideSkeleton() {
  return (
    <div className="space-y-4" data-testid="roommate-search-desktop-aside-skeleton">
      <section
        className="space-y-5 rounded-3xl border border-(--knu-border) bg-white/80 p-4 shadow-sm"
        aria-label="검색 결과와 조건 필터 로딩 중"
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-10 animate-pulse rounded-full bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-18 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-36 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-8 w-18 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="h-8 animate-pulse rounded-full bg-white shadow-sm" />
        </div>
      </section>
    </div>
  );
}

function RoommateBookmarkOnlyToggle({
  checked,
  disabled,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="저장한 후보만 보기"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-(--knu-border) bg-white text-(--knu-text-secondary) hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
      }`}
    >
      <Bookmark className={`h-4 w-4 ${checked ? 'fill-current' : ''}`} aria-hidden />
      저장한 후보만 보기
    </button>
  );
}
