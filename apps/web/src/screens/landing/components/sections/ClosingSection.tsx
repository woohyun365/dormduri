import { landingCopy } from '../../model/landingCopy';
import { SignupLink } from '../actions';
import { closingDawn } from '../sceneArt';
import { ScenePicture } from '../ScenePicture';
import { container } from '../sectionStyles';

// The closing picture's 4:5 cut fills phones; from md the 21:9 cut, matching the section's own ratio.
const wideClosingMedia = '(min-width: 48rem)';

// Closing: the title and the sign-up action only, over the dawn picture. Like the hero, the picture
// keeps the dark palette in both schemes. The section takes the picture's ratio (4:5 on a phone, 21:9
// from md) and grows if the copy needs more. The title grows only from xl: below that its larger size
// ran into the bears at the edges. With the title kept to the middle, the ellipse alone keeps it at
// 3:1 in the contrast sweep, so no base scrim.
export function ClosingSection() {
  return (
    <section
      aria-labelledby="tabs-closing-title"
      data-palette="dark"
      className="relative isolate flex aspect-4/5 items-center overflow-hidden bg-layer-basement text-fg-neutral focus-on-media md:aspect-21/9"
    >
      <ScenePicture art={closingDawn} media={wideClosingMedia} />
      <div className={`${container} flex flex-col items-center gap-6 py-16 text-center`}>
        <h2
          id="tabs-closing-title"
          className="text-title-1 font-bold break-keep text-lift xl:text-display-2"
        >
          {landingCopy.closingTitle}
        </h2>
        <SignupLink className="lift-on-hover" />
      </div>
    </section>
  );
}
