import { ArrowRight, Info } from 'lucide-react';
import { landingHeroCopy } from '../../content/landing-copy';

export function LandingHeroTrustNotice() {
  const notice = landingHeroCopy.trustNotice;

  return (
    <aside
      aria-label="서비스 이용 전 안내"
      className="mb-6 max-w-136 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
          <Info className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm/5 font-bold text-slate-800">{notice.title}</p>
          <p className="mt-1 text-sm/6 text-slate-600">{notice.description}</p>
          <a
            href={`#${notice.targetId}`}
            className="mt-2 inline-flex min-h-6 items-center gap-1 text-sm font-bold text-(--knu-primary) transition-colors hover:text-(--knu-primary-hover)"
          >
            {notice.actionLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </aside>
  );
}
