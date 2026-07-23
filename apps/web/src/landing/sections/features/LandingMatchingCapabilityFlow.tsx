import { CalendarDays, CheckCircle2, Route } from 'lucide-react';
import type { LandingMatchingCapabilityStep } from '../../content/landing-copy';

interface LandingMatchingCapabilityFlowProps {
  steps: readonly LandingMatchingCapabilityStep[];
}

export function LandingMatchingCapabilityFlow({ steps }: LandingMatchingCapabilityFlowProps) {
  return (
    <section
      aria-labelledby="matching-capability-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-blue-100 bg-blue-50/70 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 ring-1 ring-blue-100">
            <Route className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3
              id="matching-capability-title"
              className="text-lg/7 font-bold text-(--knu-text-primary)"
            >
              매칭은 이렇게 진행해요
            </h3>
            <p className="mt-0.5 text-sm/6 text-slate-600">
              후보를 확인하고 대화한 뒤 서로의 매칭을 확정해요.
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-5 md:px-6 md:py-7">
        <div className="relative">
          <span
            className="absolute top-5 bottom-5 left-5 w-px bg-blue-100 md:inset-x-[12.5%] md:bottom-auto md:h-px md:w-auto"
            aria-hidden="true"
          />

          <ol aria-label="핵심 매칭 기능 흐름" className="relative grid md:grid-cols-4">
            {steps.map((step) => {
              const AvailabilityIcon =
                step.availabilityKind === 'schedule' ? CalendarDays : CheckCircle2;

              return (
                <li
                  key={step.id}
                  className="flex gap-4 pb-6 last:pb-0 md:block md:px-3 md:pb-0 md:text-center"
                >
                  <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-600 shadow-xs md:mx-auto">
                    <step.icon className="size-4.5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 pt-0.5 md:mt-3 md:pt-0">
                    <h4 className="text-sm/6 font-bold text-(--knu-text-primary)">{step.title}</h4>
                    <p className="mt-1 text-sm/6 text-(--knu-text-secondary)">{step.description}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs/5 font-semibold text-blue-700 md:justify-center">
                      <AvailabilityIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      {step.availabilityLabel}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
