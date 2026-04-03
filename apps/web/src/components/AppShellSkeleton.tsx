'use client';

import { Skeleton, SkeletonCard } from './Skeleton';

/**
 * Main 내부 데이터 로딩 시 표시하는 스켈레톤.
 * `/` 게이트웨이 초기 진입에는 `GatewaySkeleton`을 사용한다.
 */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      {/* 헤더 영역 */}
      <div className="bg-[var(--knu-primary)] px-5 py-6">
        <div className="max-w-md mx-auto space-y-3">
          <Skeleton width="120px" height="16px" className="!bg-white/20 !rounded-lg" />
          <Skeleton width="180px" height="28px" className="!bg-white/20 !rounded-lg" />
          <div className="flex items-center justify-between">
            <Skeleton width="140px" height="14px" className="!bg-white/20 !rounded-lg" />
            <Skeleton width="48px" height="48px" className="!bg-white/20 !rounded-full" />
          </div>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="max-w-md mx-auto px-5 py-5 space-y-5">
        <SkeletonCard height="140px" />
        <SkeletonCard height="120px" />
        <SkeletonCard height="80px" />
        <SkeletonCard height="100px" />
      </div>

      {/* 헬퍼 문구 */}
      <div className="text-center mt-4">
        <p className="text-xs text-[var(--knu-text-tertiary)]">서비스를 준비하고 있어요</p>
      </div>
    </div>
  );
}
