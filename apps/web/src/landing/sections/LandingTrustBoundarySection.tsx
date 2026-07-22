import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingTrustBoundaryCopy, landingTrustBoundaryItems } from '../content/landing-copy';
import { LandingTrustBoundaryCard } from './trust-boundary/LandingTrustBoundaryCard';

export function LandingTrustBoundarySection() {
  return (
    <Section id="trust-boundary" background="alt" className="py-14 md:py-18">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)] lg:items-start lg:gap-12">
        <div className="max-w-md">
          <p className="mb-3 text-sm font-semibold text-(--knu-primary)">
            {landingTrustBoundaryCopy.eyebrow}
          </p>
          <h2 className="mb-4 text-3xl/10 font-bold tracking-tight text-(--knu-text-primary) md:text-4xl/12">
            {landingTrustBoundaryCopy.title}
          </h2>
          <LandingSentenceText
            text={landingTrustBoundaryCopy.description}
            className="text-base/7 text-(--knu-text-secondary) sm:text-lg/8"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {landingTrustBoundaryItems.map((item) => (
            <LandingTrustBoundaryCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </Section>
  );
}
