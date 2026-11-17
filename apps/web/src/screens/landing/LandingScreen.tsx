import type { BrandLogoTone } from '@/screens/ui/brand';
import { LandingDocumentBackground } from './components/LandingDocumentBackground';
import { LandingFrame } from './components/LandingFrame';
import { LandingVisitAnalytics } from './components/LandingVisitAnalytics';
import { BeforeSection } from './components/sections/BeforeSection';
import { ClosingSection } from './components/sections/ClosingSection';
import { FaqSection } from './components/sections/FaqSection';
import { Footer } from './components/sections/Footer';
import { Header } from './components/sections/Header';
import { HeroSection } from './components/sections/HeroSection';
import { ItemsSection } from './components/sections/ItemsSection';
import { NoticesSection } from './components/sections/NoticesSection';
import { SeasonSection } from './components/sections/SeasonSection';
import { StepSection } from './components/sections/StepSection';

// The landing on the Glide structure (glideapps.com), drawn dark only. In page order: what the service is, how it differs from the old way, what
// it compares, the three steps, the season, the notices, questions, and sign-up again. The `/` route
// renders it. Server render by default; the client parts are the page frame (scroll
// entrance), the hero question box, the overlapping windows, the lifestyle cards and the document
// background (html and body take the frame's background while the landing is on screen).

export function LandingScreen({
  darkLogo = 'color',
}: {
  /** Mark on the dark header and footer. */
  darkLogo?: BrandLogoTone;
}) {
  return (
    <LandingFrame className="min-h-screen">
      <Header logo={darkLogo} />
      <main>
        <HeroSection />
        <BeforeSection />
        <ItemsSection />
        <StepSection step="search" />
        <StepSection step="chat" />
        <StepSection step="match" />
        <SeasonSection />
        <NoticesSection />
        <FaqSection />
        <ClosingSection />
      </main>
      <Footer logo={darkLogo} />
      <LandingVisitAnalytics />
      <LandingDocumentBackground />
    </LandingFrame>
  );
}
