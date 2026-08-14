import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingHowItWorksCopy, landingHowItWorksSteps } from '../content/landing-copy';
import { LandingHowItWorksNotice } from './how-it-works/LandingHowItWorksNotice';
import { LandingHowItWorksStep } from './how-it-works/LandingHowItWorksStep';

export function LandingHowItWorksSection() {
  return (
    <Section id="how-it-works" className="py-16 md:py-24">
      <div className="mb-8 text-left md:mb-10 md:text-center">
        <p className="mb-3 text-sm font-semibold text-(--knu-primary)">
          {landingHowItWorksCopy.eyebrow}
        </p>
        <h2 className="mb-4 text-3xl/10 font-bold tracking-tight text-(--knu-text-primary) md:text-4xl/12">
          {landingHowItWorksCopy.title}
        </h2>
        <LandingSentenceText
          text={landingHowItWorksCopy.description}
          className="max-w-2xl text-base/7 text-(--knu-text-secondary) sm:text-lg/8 md:mx-auto"
        />
      </div>

      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70">
        <div className="relative px-5 py-6 md:px-0 md:py-0">
          <span
            className="absolute left-[16.666%] right-[16.666%] top-13 hidden h-px bg-slate-200 md:block"
            aria-hidden="true"
          />
          <ol className="relative grid grid-cols-1 md:grid-cols-3">
            {landingHowItWorksSteps.map((step, index) => (
              <LandingHowItWorksStep
                key={step.id}
                step={step}
                isLast={index === landingHowItWorksSteps.length - 1}
              />
            ))}
          </ol>
        </div>
        <LandingHowItWorksNotice />
      </div>
    </Section>
  );
}
