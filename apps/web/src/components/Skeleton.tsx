'use client';

import { motion } from 'motion/react';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '20px', className = '' }: SkeletonProps) {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`bg-gray-200 rounded-lg ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ height = '120px' }: { height?: string }) {
  return (
    <div
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4"
      style={{ height }}
    >
      <div className="flex items-start gap-3">
        <Skeleton width="48px" height="48px" className="rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height="20px" />
          <Skeleton width="40%" height="16px" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ cols = 2, rows = 2 }: { cols?: number; rows?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-3`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <SkeletonCard key={i} height="100px" />
      ))}
    </div>
  );
}

export function HomeTabSkeleton() {
  return (
    <div className="max-w-md mx-auto px-5 py-5 space-y-5">
      <SkeletonCard height="140px" />
      <SkeletonCard height="120px" />
      <SkeletonCard height="80px" />
      <div>
        <Skeleton width="120px" height="24px" className="mb-3" />
        <SkeletonGrid cols={2} rows={2} />
      </div>
      <SkeletonCard height="180px" />
      <div>
        <Skeleton width="140px" height="24px" className="mb-3" />
        <SkeletonCard height="160px" />
      </div>
    </div>
  );
}
