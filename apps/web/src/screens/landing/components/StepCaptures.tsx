import { stepCaptures } from '../model/landingCopy';
import { CaptureSlot } from './CaptureSlot';

// The right side of the three steps, capture slots instead of demos since the main screens may
// change: two phone screens per step, gray until captures of the main tabs exist. The
// main tabs lay out at phone width (max-w-md), so every slot is a phone capture, on wide screens too.

type StepScreens = (typeof stepCaptures)[keyof Omit<typeof stepCaptures, 'size'>];

export function StepCaptures({ screens }: { screens: StepScreens }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6">
      {screens.map((screen) => (
        <figure key={screen.caption} className="flex flex-col items-center gap-3">
          <div className="flex w-full max-w-64 flex-col overflow-hidden rounded-sheet border-8 border-layer-inverse depth-window">
            <CaptureSlot label={screen.slot} size={stepCaptures.size} className="aspect-390/844" />
          </div>
          <figcaption className="text-label text-fg-muted">{screen.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}
