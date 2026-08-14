import type { LandingHowItWorksStep as LandingHowItWorksStepContent } from '../../content/landing-copy';

interface LandingHowItWorksStepProps {
  isLast: boolean;
  step: LandingHowItWorksStepContent;
}

export function LandingHowItWorksStep({ isLast, step }: LandingHowItWorksStepProps) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0 md:block md:px-6 md:py-8 md:text-center">
      {!isLast ? (
        <span
          className="absolute bottom-0 left-5 top-10 w-px bg-slate-200 md:hidden"
          aria-hidden="true"
        />
      ) : null}
      <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-(--knu-primary) text-sm font-bold text-white shadow-sm md:mx-auto">
        {step.order}
      </span>
      <div className="min-w-0 pt-1 md:mt-5 md:pt-0">
        <h3 className="text-lg/7 font-bold text-(--knu-text-primary)">{step.title}</h3>
        <p className="mt-1.5 text-sm/6 text-(--knu-text-secondary)">{step.description}</p>
      </div>
    </li>
  );
}
