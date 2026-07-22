import { LandingSentenceText } from '../../components/LandingSentenceText';
import type { LandingTrustBoundaryItem } from '../../content/landing-copy';

interface LandingTrustBoundaryCardProps {
  item: LandingTrustBoundaryItem;
}

export function LandingTrustBoundaryCard({ item }: LandingTrustBoundaryCardProps) {
  return (
    <article className="flex items-start gap-4 rounded-2xl border border-(--knu-border) bg-white p-4 sm:p-5">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${item.iconSurfaceClass}`}
      >
        <item.icon className={`size-5 ${item.iconColor}`} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-base/6 font-bold text-(--knu-text-primary)">{item.title}</h3>
        <LandingSentenceText
          text={item.description}
          className="mt-1 text-sm/6 text-(--knu-text-secondary)"
        />
      </div>
    </article>
  );
}
