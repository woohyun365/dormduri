import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';
import { LandingHeroSection } from './sections/LandingHeroSection';
import { LandingProblemSolutionSection } from './sections/LandingProblemSolutionSection';
import { LandingFeaturesSection } from './sections/LandingFeaturesSection';
import { LandingSeasonPolicySection } from './sections/LandingSeasonPolicySection';
import { LandingFaqSection } from './sections/LandingFaqSection';
import { LandingCtaSection } from './sections/LandingCtaSection';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <LandingHeroSection />
      <LandingProblemSolutionSection />
      <LandingFeaturesSection />
      <LandingSeasonPolicySection />
      <LandingFaqSection />
      <LandingCtaSection />
      <LandingFooter />
    </div>
  );
}
