import { Mail, Sparkles } from 'lucide-react';
import { Section } from '../components/Section';
import { LandingPrimaryCtaLink } from '../components/LandingPrimaryCtaLink';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { landingHeroCopy } from '../content/landing-copy';
import { LandingHeroPreviewPanel } from './hero/LandingHeroPreviewPanel';
import { LandingHeroTrustNotice } from './hero/LandingHeroTrustNotice';

export function LandingHeroSection() {
  return (
    <Section id="hero" className="pb-12 pt-12 md:pb-16 md:pt-16 lg:pb-20 lg:pt-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-start lg:gap-12">
        <div className="min-w-0">
          <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full bg-(--knu-primary-light) px-3 py-1.5 sm:px-4 sm:py-2">
            <Sparkles className="w-4 h-4 text-(--knu-primary)" aria-hidden="true" />
            <span className="text-xs font-semibold leading-5 text-(--knu-primary) sm:text-sm">
              {landingHeroCopy.eyebrow}
            </span>
          </div>
          <h1 className="mb-5 max-w-[15ch] text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.18] tracking-tight text-(--knu-text-primary)">
            {landingHeroCopy.headlineLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <LandingSentenceText
            text={landingHeroCopy.description}
            className="mb-4 max-w-136 text-base/6 font-medium text-(--knu-text-secondary) sm:text-lg/7"
          />
          <LandingHeroTrustNotice />
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <LandingPrimaryCtaLink href={landingHeroCopy.primaryCta.href} size="hero">
              <Mail className="w-5 h-5" aria-hidden="true" />
              {landingHeroCopy.primaryCta.label}
            </LandingPrimaryCtaLink>
            <a
              href={`#${landingHeroCopy.secondaryCta.targetId}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-(--knu-border) px-5 text-base font-semibold text-(--knu-text-primary) transition-colors hover:border-(--knu-primary) hover:bg-(--knu-primary-light) sm:h-14 sm:px-7 sm:text-lg"
            >
              {landingHeroCopy.secondaryCta.label}
            </a>
          </div>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-start">
          <LandingHeroPreviewPanel />
        </div>
      </div>
    </Section>
  );
}
