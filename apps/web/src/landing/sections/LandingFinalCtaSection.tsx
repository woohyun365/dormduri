import { Mail } from 'lucide-react';
import Link from 'next/link';
import { Section } from '../components/Section';
import { LandingPrimaryCtaLink } from '../components/LandingPrimaryCtaLink';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { landingFinalCtaCopy } from '../content/landing-copy';

export function LandingFinalCtaSection() {
  return (
    <Section id="final-cta" className="py-16 md:py-24">
      <div className="text-center max-w-3xl mx-auto rounded-3xl bg-[var(--knu-primary-light)] border-2 border-blue-100 px-6 py-12 md:px-10">
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          {landingFinalCtaCopy.title}
        </h2>
        <LandingSentenceText
          text={landingFinalCtaCopy.description}
          className="text-lg text-[var(--knu-text-secondary)] leading-relaxed mb-8"
        />
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <LandingPrimaryCtaLink href={landingFinalCtaCopy.primaryCta.href}>
            <Mail className="w-5 h-5" aria-hidden="true" />
            {landingFinalCtaCopy.primaryCta.label}
          </LandingPrimaryCtaLink>
          <Link
            href={landingFinalCtaCopy.secondaryCta.href}
            className="font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 border-2 border-[var(--knu-border)] hover:border-[var(--knu-primary)] bg-white text-[var(--knu-text-primary)] h-14 px-8 text-lg"
          >
            {landingFinalCtaCopy.secondaryCta.label}
          </Link>
        </div>
      </div>
    </Section>
  );
}
