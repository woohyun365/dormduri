import { Mail, Sparkles } from 'lucide-react';
import { Section } from '../components/Section';
import { LandingPrimaryCtaLink } from '../components/LandingPrimaryCtaLink';
import { LandingProfilePreviewCard } from '../components/LandingProfilePreviewCard';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { ScrollToButton } from '../components/ScrollToButton';
import { landingHeroCopy } from '../content/landing-copy';
import { getLandingPolicyCopy } from '../content/landing-policy-copy';
import { landingProfilePreviewItems } from '../content/landing-preview-fixtures';

export function LandingHeroSection() {
  return (
    <Section id="hero" className="pt-16 md:pt-24 pb-14 md:pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-(--knu-primary-light) rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-(--knu-primary)" aria-hidden="true" />
            <span className="text-sm font-semibold text-(--knu-primary)">
              {landingHeroCopy.eyebrow}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-(--knu-text-primary) mb-6 leading-tight">
            {landingHeroCopy.headlineLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <LandingSentenceText
            text={landingHeroCopy.description}
            className="text-lg text-(--knu-text-secondary) leading-relaxed mb-5 max-w-xl"
          />
          <ul className="space-y-2 mb-8 text-sm text-(--knu-text-secondary)">
            {landingHeroCopy.policyCopyIds.map((id) => (
              <li key={id} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-(--knu-primary) shrink-0" />
                <span>{getLandingPolicyCopy(id).copy}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-4">
            <LandingPrimaryCtaLink href={landingHeroCopy.primaryCta.href}>
              <Mail className="w-5 h-5" aria-hidden="true" />
              {landingHeroCopy.primaryCta.label}
            </LandingPrimaryCtaLink>
            <ScrollToButton
              targetId={landingHeroCopy.secondaryCta.targetId}
              className="font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 border-2 border-(--knu-border) hover:border-(--knu-primary) hover:bg-(--knu-primary-light) text-(--knu-text-primary) h-14 px-8 text-lg"
            >
              {landingHeroCopy.secondaryCta.label}
            </ScrollToButton>
          </div>
        </div>

        <div className="space-y-4" aria-label="룸메이트 후보 카드 예시">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {landingProfilePreviewItems.map((profile) => (
              <LandingProfilePreviewCard key={profile.id} profile={profile} />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
