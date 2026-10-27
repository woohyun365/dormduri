'use client';

import { useState, type ReactNode } from 'react';
import { beforeStack } from '../model/landingCopy';
import { soft, softDelay } from './sectionStyles';

type BeforeCard = 'post' | 'service';

// The window behind shrinks and darkens under a scrim (both are browser windows, so the one behind must
// read as behind), only as far as its text keeps 4.5:1. Headroom: the post holds to 39% once its blue
// labels turn dark behind (2% with them blue), the service window to 23% (its gray slot text); 35% and
// 20% leave margin. A scrim on top, not the window fading
// over a dark backdrop: axe blends a faded group's text once more over the faded background and reports
// failures that are not on screen; over a scrim it leaves the text for review instead.
const backDim: Record<BeforeCard, string> = {
  post: 'opacity-35',
  service: 'opacity-20',
};

function BackScrim({ behind, which }: { behind: boolean; which: BeforeCard }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-panel bg-media-scrim stack-dim ${behind ? backDim[which] : 'opacity-0'}`}
    />
  );
}

// The 지금까지 community post and the 이제는 service card overlap, the service card in front. The
// windows come in as server-rendered children; only the switch is client code. Only the switch brings
// a window to the front: neither hover nor a tap on a window does, because a finger that drags the page
// down over the post caught it as a tap and hid the service card (Owner 2026-10-27).
export function BeforeStack({ post, service }: { post: ReactNode; service: ReactNode }) {
  const [front, setFront] = useState<BeforeCard>('service');
  const cardClass = (which: BeforeCard) =>
    `relative col-start-1 row-start-1 self-start stack-swap ${front === which ? 'z-10' : 'z-0 scale-95'}`;
  // Cells name their start and end lines: col-span would reset the start and push a card off the grid.
  return (
    <div className={`flex flex-col gap-4 ${soft} ${softDelay[1]}`}>
      <div role="group" aria-label={beforeStack.switchLabel} className="flex flex-wrap gap-2">
        {(['post', 'service'] as const).map((which) => (
          <button
            key={which}
            type="button"
            aria-pressed={front === which}
            onClick={() => setFront(which)}
            className="inline-flex min-h-target-min items-center rounded-full border border-stroke-subtle px-3 py-1.5 text-label font-bold focus-visible:focus-ring aria-pressed:border-brand-solid aria-pressed:bg-brand-solid aria-pressed:text-fg-on-brand"
          >
            {beforeStack.labels[which]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div
          data-back={front === 'post' ? undefined : ''}
          className={`lg:col-end-9 ${cardClass('post')}`}
        >
          {post}
          <BackScrim behind={front !== 'post'} which="post" />
        </div>
        <div
          data-back={front === 'service' ? undefined : ''}
          className={`mt-56 lg:col-start-5 lg:col-end-13 lg:mt-28 ${cardClass('service')}`}
        >
          {service}
          <BackScrim behind={front !== 'service'} which="service" />
        </div>
      </div>
    </div>
  );
}
