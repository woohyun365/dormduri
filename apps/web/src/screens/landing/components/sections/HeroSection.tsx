import { landingCopy } from '../../model/landingCopy';
import { LANDING_SURFACE_SECTION_IDS } from '../../model/landingPolicyCopy';
import { SignupLink } from '../actions';
import { HeroAsk } from '../HeroAsk';
import { NoticeLines } from '../NoticeLines';
import { heroNight } from '../sceneArt';
import { ScenePicture } from '../ScenePicture';
import { container } from '../sectionStyles';

// The wide cut fills every screen 3:5 and wider; upright phones get the tall cut, bottom-aligned so the
// bears stay low. Wider than a phone, the tall cut grows to the full width and puts the desk lamps and
// the moon right behind the copy, so tablets take the middle of the wide cut. The aspect-ratio
// condition is not a breakpoint token (screens/README.md, lint 한계).
const wideHeroMedia = '(min-aspect-ratio: 3/5)';

// The night picture is dark in both schemes, so the hero always takes the dark palette (nestable)
// and a white focus ring. No season badge: the landing shows no season D-day (the main page owns it).
// Where the tall cut shows (upright phones), a 12rem bottom padding sets the copy 4rem above the
// middle: centered, the body ran over the moon. The pause toggle under the question box makes the copy
// 3.25rem taller, and on short phones the sign-up note then lands on the bears; the picture's base
// scrim (ScenePicture) holds the contrast there.
export function HeroSection() {
  return (
    <section
      id={LANDING_SURFACE_SECTION_IDS.hero}
      aria-labelledby="tabs-hero-title"
      data-palette="dark"
      className="relative isolate overflow-hidden bg-layer-basement text-fg-neutral focus-on-media"
    >
      <ScenePicture art={heroNight} media={wideHeroMedia} hero />
      <div
        className={`${container} flex min-h-svh flex-col items-center justify-center gap-6 py-16 text-center [@media(max-aspect-ratio:3/5)]:pb-48`}
      >
        <h1
          id="tabs-hero-title"
          className="text-display-3 font-bold break-keep text-lift md:text-display-1"
        >
          {/* Each line rises out of its own clipping box on load; the text keeps full opacity. The
              box clips only during the rise, so the glow on 생활패턴 is not cut into a box. */}
          <span className="block pb-2 line-mask">
            <span className="block text-balance line-rise">{landingCopy.heroTitle.lead}</span>
          </span>
          <span className="block pb-2 line-mask enter-delay-2">
            <span className="block text-balance line-rise enter-delay-2">
              {' '}
              <span className="text-fg-brand text-glow">{landingCopy.heroTitle.accent}</span>
              {landingCopy.heroTitle.rest}
            </span>
          </span>
        </h1>
        <p className="max-w-reading text-body-sm text-fg-muted break-keep text-pretty">
          {landingCopy.body}
        </p>
        {/* The question box, the sign-up action and the notices rise together, so nothing overlaps. */}
        <div className="flex w-full flex-col items-center gap-6 card-in enter-delay-4">
          <HeroAsk />
          <div className="flex flex-col items-center gap-2">
            <SignupLink className="lift-on-hover" />
            <p className="text-label break-keep">{landingCopy.heroCtaResult}</p>
          </div>
          <NoticeLines className="text-label text-fg-muted" />
        </div>
      </div>
    </section>
  );
}
