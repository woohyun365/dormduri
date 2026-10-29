import type { Decorator } from '@storybook/nextjs-vite';
import { LandingFrame, type LandingScheme } from '../components/LandingFrame';
import { container } from '../components/sectionStyles';

// Section and component stories render inside the page frame (LandingFrame), so each part shows in the
// palette context and font it has on the page. The `scheme` arg switches the context. On a Docs page the
// frame takes its content's height, so a small part does not fill a screen.

export type FrameArgs = { scheme: LandingScheme };

export const frameArgTypes = {
  scheme: {
    control: 'inline-radio',
    options: ['dark', 'light'],
    description: '페이지 palette 문맥(어두운 판 dark · 밝은 판 light)',
  },
} as const;

function schemeOf(args: Record<string, unknown>): LandingScheme {
  return args.scheme === 'light' ? 'light' : 'dark';
}

// A whole section, edge to edge.
export const inLandingFrame: Decorator = (Story, { args, viewMode }) => (
  <LandingFrame scheme={schemeOf(args)} className={viewMode === 'docs' ? '' : 'min-h-screen'}>
    <Story />
  </LandingFrame>
);

// A part on its own, inside the page's content width.
export const inLandingPanel: Decorator = (Story, { args, viewMode }) => (
  <LandingFrame scheme={schemeOf(args)} className={viewMode === 'docs' ? '' : 'min-h-screen'}>
    <div className={`${container} py-section`}>
      <Story />
    </div>
  </LandingFrame>
);
