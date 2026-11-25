import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';

// Check widths of the backoffice screens (src/ui/README.md ⑨): 1280 and 1440 first, 390 for reflow.
const viewports = {
  desktop1280: {
    name: 'Desktop · 1280px',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
  desktop1440: {
    name: 'Desktop · 1440px',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  mobile390: {
    name: 'Mobile · 390px',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
} as const;

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    // App Router hooks (useRouter, usePathname) need the app directory mocks.
    nextjs: {
      appDirectory: true,
    },
    viewport: {
      options: viewports,
    },
  },
  decorators: [
    // The same page background, text and line breaking as the root layout body (src/app/layout.tsx).
    (Story) => (
      <div className="min-h-screen bg-layer-basement text-fg-neutral antialiased break-keep wrap-break-word text-pretty">
        <Story />
      </div>
    ),
  ],
};

export default preview;
