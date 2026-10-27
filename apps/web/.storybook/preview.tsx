import type { Preview } from '@storybook/nextjs-vite';
import { fontVariablesClassName } from '../src/styles/fonts';
import '../src/app/globals.css';
import '../src/styles/knu.css';

const matchingBaselineViewports = {
  webMobile320: {
    name: 'Web mobile · 320px',
    styles: { width: '320px', height: '568px' },
    type: 'mobile',
  },
  webMobile390: {
    name: 'Web mobile · 390px',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  webDesktop1280: {
    name: 'Web desktop · 1280px',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
  webDesktop1440: {
    name: 'Web desktop · 1440px',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  matchingMobile320: {
    name: 'Matching mobile · 320px',
    styles: { width: '320px', height: '568px' },
    type: 'mobile',
  },
  matchingMobile360: {
    name: 'Matching mobile · 360px',
    styles: { width: '360px', height: '800px' },
    type: 'mobile',
  },
  matchingMobile390: {
    name: 'Matching mobile · 390px',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  matchingMobile430: {
    name: 'Matching mobile · 430px',
    styles: { width: '430px', height: '932px' },
    type: 'mobile',
  },
  matchingDesktop1280: {
    name: 'Matching desktop · 1280px',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
  matchingDesktop1440: {
    name: 'Matching desktop · 1440px',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
};

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      defaultViewport: 'responsive',
      viewports: matchingBaselineViewports,
    },
    options: {
      storySort: {
        order: [
          // Foundations (token docs, then the samples), then the Landing sections and parts in page
          // order.
          'Foundations',
          [
            'Overview',
            'Color',
            'Typography',
            'Spacing & Layout',
            'Motion',
            'Target & Focus',
            'Samples',
            ['Tokens', 'Palettes'],
          ],
          'Landing',
          [
            'Page',
            'Sections',
            [
              'Header',
              'Hero',
              'Before',
              'Items',
              'Step',
              'Season',
              'Notices',
              'Faq',
              'Closing',
              'Footer',
            ],
            'Components',
            [
              'BrandMark',
              'Actions',
              'HeroAsk',
              'NoticeLines',
              'CommunityPost',
              'StatementFields',
              'StepCaptures',
              'SeasonLanes',
              'FaqAccordion',
            ],
          ],
          'Auth',
          [
            '*',
            'Signup',
            [
              'Step 1 Email',
              'Step 2 Legal',
              'Step 3 Credentials',
              'Step 4 Academic Identity',
              'Step 5 Complete',
              'Recovery',
              '*',
            ],
            'Password Reset',
            [
              'Step 1 Email',
              'Step 2 Verification',
              'Step 3 New Password',
              'Result',
              'Session',
              '*',
            ],
          ],
          '*',
        ],
      },
    },
  },
  decorators: [
    // Stories tagged knu-layer (token samples, src/screens) render on the new token layer and fonts.
    // On a Docs page they take their content's height instead of a full screen each.
    (Story, { tags, viewMode }) =>
      tags.includes('knu-layer') ? (
        <div
          className={`${fontVariablesClassName} ${viewMode === 'docs' ? '' : 'min-h-screen'} bg-layer-basement font-body text-fg-neutral`}
        >
          <Story />
        </div>
      ) : (
        <div className="min-h-screen bg-(--knu-background-alt) text-(--knu-text-primary)">
          <Story />
        </div>
      ),
  ],
  beforeEach: ({ parameters }) => {
    const matchingBaseline = parameters.matchingBaseline as { now?: string } | undefined;
    if (!matchingBaseline?.now) return undefined;

    const originalDateNow = Date.now;
    const frozenNow = new Date(matchingBaseline.now).getTime();
    Date.now = () => frozenNow;

    return () => {
      Date.now = originalDateNow;
    };
  },
};

export default preview;
