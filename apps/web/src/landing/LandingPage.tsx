import type { ReactNode } from 'react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';
import { LandingHeroSection } from './sections/LandingHeroSection';
import { LandingTrustBoundarySection } from './sections/LandingTrustBoundarySection';
import { LandingHowItWorksSection } from './sections/LandingHowItWorksSection';
import { LandingFeatureSection } from './sections/LandingFeatureSection';
import { LandingSeasonPolicySection } from './sections/LandingSeasonPolicySection';
import { LandingSafetySupportSection } from './sections/LandingSafetySupportSection';
import { LandingFaqSection } from './sections/LandingFaqSection';
import { LandingFinalCtaSection } from './sections/LandingFinalCtaSection';

interface LandingPageProps {
  faqSection?: ReactNode;
}

export default function LandingPage({ faqSection }: LandingPageProps = {}) {
  return (
    <div className="min-h-screen bg-white keep-all">
      <LandingHeader />
      <main>
        <LandingHeroSection />
        <LandingTrustBoundarySection />
        <LandingHowItWorksSection />
        <LandingFeatureSection />
        <LandingSeasonPolicySection />
        <LandingSafetySupportSection />
        {faqSection ?? <LandingFaqSection />}
        <LandingFinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
