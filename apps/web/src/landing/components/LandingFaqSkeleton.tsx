interface LandingFaqSkeletonProps {
  itemCount?: number;
  label?: string;
  className?: string;
}

const DEFAULT_FAQ_SKELETON_ITEMS = 4;

const clampSkeletonItemCount = (itemCount: number) => Math.max(1, Math.floor(itemCount));

export function LandingFaqSkeleton({
  itemCount = DEFAULT_FAQ_SKELETON_ITEMS,
  label = '자주 묻는 질문을 불러오는 중이에요',
  className,
}: LandingFaqSkeletonProps) {
  const itemIndexes = Array.from(
    { length: clampSkeletonItemCount(itemCount) },
    (_, index) => index,
  );
  const classNames = ['rounded-2xl border-2 border-(--knu-border) bg-white p-4 md:p-5', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="status" aria-live="polite" aria-busy="true" className={classNames}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        {itemIndexes.map((index) => (
          <div
            key={index}
            data-testid="landing-faq-skeleton-row"
            className="rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) px-5 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-7/12 rounded-full bg-slate-200 animate-pulse motion-reduce:animate-none" />
              <div className="h-7 w-7 rounded-full bg-slate-200 animate-pulse motion-reduce:animate-none" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full rounded-full bg-slate-200 animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-5/6 rounded-full bg-slate-200 animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
