import { CalendarRange } from 'lucide-react';
import { landingHowItWorksCopy } from '../../content/landing-copy';

export function LandingHowItWorksNotice() {
  const notice = landingHowItWorksCopy.notice;

  return (
    <aside
      aria-label="학기별 매칭 일정 안내"
      className="flex items-start gap-3 border-t border-slate-200 bg-white/70 px-5 py-4 md:flex-col md:items-center md:gap-2.5 md:px-6 md:py-6 md:text-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-transparent text-(--knu-primary)">
        <CalendarRange className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 md:max-w-xl">
        <p className="text-sm/5 font-bold text-(--knu-text-primary)">{notice.title}</p>
        <p className="mt-0.5 text-sm/6 text-(--knu-text-secondary)">{notice.description}</p>
      </div>
    </aside>
  );
}
