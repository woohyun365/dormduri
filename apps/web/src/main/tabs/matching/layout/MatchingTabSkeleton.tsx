'use client';

import { Skeleton, SkeletonCard } from '@/main/components/feedback/Skeleton';
import { MatchingTabHeader } from './MatchingTabHeader';
import { MatchingTabLayout } from './MatchingTabLayout';

export function MatchingTabSkeleton() {
  return (
    <MatchingTabLayout
      busy
      header={<MatchingTabHeader />}
      rail={
        <div className="rounded-3xl border border-(--knu-border) bg-white p-5 shadow-sm">
          <Skeleton width="132px" height="20px" />
          <div className="mt-4 space-y-3">
            <Skeleton width="100%" height="14px" />
            <Skeleton width="88%" height="14px" />
            <Skeleton width="72%" height="14px" />
          </div>
        </div>
      }
    >
      <div className="space-y-4" aria-label="매칭 정보를 불러오는 중">
        <SkeletonCard height="156px" />
        <SkeletonCard height="132px" />
        <SkeletonCard height="112px" />
      </div>
    </MatchingTabLayout>
  );
}
