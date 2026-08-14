'use client';

import { Skeleton } from '@/main/components/feedback/Skeleton';
import { MatchingTabHeader } from './MatchingTabHeader';
import { MatchingTabLayout } from './MatchingTabLayout';
import type { MatchingShellPresentation } from '../model/matching-shell-presentation';
import type { MatchingViewerHeader } from '../model/matching-viewer-header';

export function MatchingTabSkeleton({
  presentation,
  viewer,
}: {
  readonly presentation?: MatchingShellPresentation;
  readonly viewer?: MatchingViewerHeader;
}) {
  return (
    <div className="min-h-full bg-(--knu-background-alt)">
      <MatchingTabHeader hero={presentation?.hero} viewer={viewer} />
      <div className="border-b border-slate-200/80 bg-(--knu-background-alt) py-3 shadow-sm">
        <div className="mx-auto w-full max-w-md px-4 min-[361px]:px-5 md:max-w-5xl">
          <div
            aria-hidden
            className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1"
          >
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <Skeleton width="72px" height="16px" className="mx-auto" />
            </div>
            <div className="px-4 py-3">
              <Skeleton width="64px" height="16px" className="mx-auto" />
            </div>
          </div>
        </div>
      </div>
      <MatchingTabLayout busy width="archive">
        <div
          role="status"
          aria-live="polite"
          aria-label="매칭 정보를 불러오는 중"
          className="grid items-start gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]"
          data-testid="matching-tab-loading-layout"
        >
          <span className="sr-only">현재 시즌과 요청 상태를 확인하고 있어요.</span>
          <div className="space-y-4" aria-hidden>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton width="48px" height="48px" className="shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton width="132px" height="20px" />
                  <Skeleton width="196px" height="14px" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-2xl bg-slate-50 p-3">
                    <Skeleton width="28px" height="28px" className="mx-auto rounded-full" />
                    <Skeleton width="42px" height="12px" className="mx-auto mt-2" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton width="112px" height="18px" />
                  <Skeleton width="176px" height="13px" />
                </div>
                <Skeleton width="56px" height="28px" className="rounded-full" />
              </div>
              <div className="mt-4 space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"
                  >
                    <Skeleton width="40px" height="40px" className="shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton width="58%" height="14px" />
                      <Skeleton width="42%" height="12px" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside aria-hidden className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton width="96px" height="18px" />
            <Skeleton width="82%" height="13px" className="mt-3" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton width="36px" height="36px" className="shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton width="72%" height="13px" />
                    <Skeleton width="48%" height="11px" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </MatchingTabLayout>
    </div>
  );
}
