import type { StorybookConfig } from '@storybook/nextjs-vite';

// Stories of the backoffice Web (src/ui/README.md ⑨). `storybook build` runs in this app, so the framework reads
// this app's next.config.ts. The backoffice does not turn on React Compiler (next.config.ts), so no compiler plugin
// is added, and no docs addon is loaded: the design guide is src/ui/README.md, not a docs page.
const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  stories: ['../src/**/__stories__/*.stories.tsx'],
  addons: [],
  staticDirs: [],
  core: {
    disableTelemetry: true,
  },
};

export default config;
