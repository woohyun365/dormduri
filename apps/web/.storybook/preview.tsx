import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';
import '../src/styles/knu.css';

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
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-(--knu-background-alt) text-(--knu-text-primary)">
        <Story />
      </div>
    ),
  ],
};

export default preview;
