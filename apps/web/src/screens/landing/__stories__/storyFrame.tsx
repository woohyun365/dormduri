import type { Decorator } from '@storybook/nextjs-vite';
import { LandingFrame } from '../components/LandingFrame';
import { container } from '../components/sectionStyles';

// Section and component stories render inside the page frame (LandingFrame), so each part shows in the
// palette context (dark) and font it has on the page. On a Docs page the frame takes its content's
// height, so a small part does not fill a screen.

// A whole section, edge to edge.
export const inLandingFrame: Decorator = (Story, { viewMode }) => (
  <LandingFrame className={viewMode === 'docs' ? '' : 'min-h-screen'}>
    <Story />
  </LandingFrame>
);

// A part on its own, inside the page's content width.
export const inLandingPanel: Decorator = (Story, { viewMode }) => (
  <LandingFrame className={viewMode === 'docs' ? '' : 'min-h-screen'}>
    <div className={`${container} py-section`}>
      <Story />
    </div>
  </LandingFrame>
);
