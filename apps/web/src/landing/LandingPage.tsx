import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';
import { landingFooterCopy } from './content/landing-copy';
import { LandingHeroSection } from './sections/LandingHeroSection';
import { LandingTrustBoundarySection } from './sections/LandingTrustBoundarySection';
import { LandingHowItWorksSection } from './sections/LandingHowItWorksSection';
import { LandingFeatureSection } from './sections/LandingFeatureSection';
import { LandingSeasonPolicySection } from './sections/LandingSeasonPolicySection';
import { LandingSupportSection } from './sections/LandingSupportSection';
import { LandingFinalCtaSection } from './sections/LandingFinalCtaSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white keep-all">
      <LandingHeader />
      <main>
        <LandingHeroSection />
        <LandingTrustBoundarySection />
        <LandingHowItWorksSection />
        <LandingFeatureSection />
        <LandingSeasonPolicySection />
        <LandingSupportSection />
        <LandingFinalCtaSection />
      </main>
      <LandingFooter externalInquiryEmail={landingFooterCopy.externalInquiryEmail} />
    </div>
  );
}
