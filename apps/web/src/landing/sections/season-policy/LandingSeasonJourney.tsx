import { CalendarDays } from 'lucide-react';
import type { LandingSeasonJourneyItem } from '../../content/landing-copy';
import { seasonPolicyPresentation } from './seasonPolicyPresentation';

interface LandingSeasonJourneyProps {
  items: readonly LandingSeasonJourneyItem[];
}

export function LandingSeasonJourney({ items }: LandingSeasonJourneyProps) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 md:mb-8 md:p-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <h3 className="text-lg/7 font-bold text-(--knu-text-primary)">한 학기 이용 흐름</h3>
        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2">
          <CalendarDays
            className="mt-0.5 size-4 shrink-0 text-(--knu-primary)"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs/5 font-semibold text-(--knu-primary)">가상 일정 예시</p>
            <p className="text-xs/5 text-slate-600">
              실제 일정과 매칭 종료일은 학기·기숙사마다 달라요
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <span
          className="absolute top-5 bottom-5 left-5 w-px bg-slate-200 md:inset-x-[12.5%] md:bottom-auto md:h-px md:w-auto"
          aria-hidden="true"
        />
        <ol aria-label="한 학기 이용 흐름 예시" className="relative grid md:grid-cols-4">
          {items.map((item) => {
            const Icon = seasonPolicyPresentation[item.state];

            return (
              <li
                key={item.state}
                className="flex gap-4 pb-6 last:pb-0 md:block md:px-3 md:pb-0 md:text-center"
              >
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-(--knu-primary) md:mx-auto">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-0.5 md:mt-3 md:pt-0">
                  <h4 className="text-sm/6 font-bold text-(--knu-text-primary)">
                    {item.journeyLabel}
                  </h4>
                  <p className="mt-1 text-sm/6 font-semibold text-slate-700">
                    {item.journeyDateLabel}
                  </p>
                  <p className="mt-0.5 text-xs/5 font-semibold text-(--knu-primary)">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm/6 text-(--knu-text-secondary)">
                    {item.journeyDescription}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
