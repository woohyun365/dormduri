import { Mail } from 'lucide-react';
import { Section } from '../components/Section';
import { LandingPrimaryCtaLink } from '../components/LandingPrimaryCtaLink';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { landingFinalCtaCopy } from '../content/landing-copy';

export function LandingFinalCtaSection() {
  return (
    <Section id="final-cta" className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-sm font-semibold text-(--knu-primary)">
          {landingFinalCtaCopy.eyebrow}
        </p>
        <h2 className="text-2xl/9 font-bold text-(--knu-text-primary) md:text-3xl/10">
          {landingFinalCtaCopy.title}
        </h2>
        <LandingSentenceText
          text={landingFinalCtaCopy.description}
          className="mt-3 text-sm/6 text-(--knu-text-secondary) sm:text-base/7"
        />

        <div className="mx-auto mt-7 flex max-w-sm flex-col sm:flex-row sm:justify-center">
          <LandingPrimaryCtaLink href={landingFinalCtaCopy.primaryCta.href} size="compact">
            <Mail className="size-5" aria-hidden="true" />
            {landingFinalCtaCopy.primaryCta.label}
          </LandingPrimaryCtaLink>
        </div>
      </div>
    </Section>
  );
}
