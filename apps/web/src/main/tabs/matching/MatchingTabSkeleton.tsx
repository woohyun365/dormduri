'use client';

import { Skeleton, SkeletonCard } from '@/components/Skeleton';

/**
 * 매칭 탭 로딩 스켈레톤.
 * 헤더 + SubNav + 카드 3장 형태.
 */
export function MatchingTabSkeleton() {
  return (
    <div>
      {/* 헤더 */}
      <div className="bg-white border-b-2 border-[var(--knu-border)] px-5 py-4">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton width="20px" height="20px" className="rounded" />
            <Skeleton width="100px" height="22px" />
          </div>
          <Skeleton width="180px" height="14px" />
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        {/* SubNav 스켈레톤 */}
        <div className="flex gap-2 p-1 bg-[var(--knu-background-alt)] rounded-xl border-2 border-[var(--knu-border)]">
          <Skeleton width="100%" height="40px" className="rounded-lg" />
          <Skeleton width="100%" height="40px" className="rounded-lg" />
        </div>

        {/* 카드 스켈레톤 */}
        <SkeletonCard height="160px" />
        <SkeletonCard height="140px" />
        <SkeletonCard height="120px" />
      </div>
    </div>
  );
}
