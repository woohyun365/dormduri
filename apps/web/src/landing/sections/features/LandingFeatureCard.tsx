import type { LandingIconCopyItem } from '../../content/landing-copy';

interface LandingFeatureCardProps {
  item: LandingIconCopyItem;
}

export function LandingFeatureCard({ item }: LandingFeatureCardProps) {
  return (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <item.icon className={`size-5.5 ${item.iconColor}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-lg/7 font-bold text-(--knu-text-primary)">{item.title}</h3>
          <p className="mt-1.5 text-sm/6 text-(--knu-text-secondary)">{item.description}</p>
        </div>
      </div>
    </article>
  );
}
