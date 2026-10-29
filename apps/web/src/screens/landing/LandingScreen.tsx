import type { BrandLogoTone } from '@/screens/ui/brand';
import { LandingFrame, type LandingScheme } from './components/LandingFrame';
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

// The landing on the Glide structure (glideapps.com), dark first with a light variant. In page order: what the service is, how it differs from the old way, what
// it compares, the three steps, the season, the notices, questions, and sign-up again. The `/` route
// renders it. Server render by default; the client parts are the page frame (scroll
// entrance), the hero question box, the overlapping windows and the lifestyle cards.

export function LandingScreen({
  scheme = 'dark',
  darkLogo = 'color',
}: {
  scheme?: LandingScheme;
  /** Mark on the dark header and footer; the light scheme always shows the color mark. */
  darkLogo?: BrandLogoTone;
}) {
  const logo: BrandLogoTone = scheme === 'dark' ? darkLogo : 'color';
  return (
    <LandingFrame scheme={scheme} className="min-h-screen">
      <Header logo={logo} />
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
      <Footer logo={logo} />
    </LandingFrame>
  );
}
