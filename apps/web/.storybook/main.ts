import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  stories: [
    '../src/main/tabs/home/**/*.stories.@(ts|tsx|mdx)',
    '../src/main/tabs/roommate-list/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: ['@storybook/addon-docs'],
  staticDirs: [],
};

export default config;
