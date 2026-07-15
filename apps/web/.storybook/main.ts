import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  stories: [
    '../src/legal/__stories__/**/*.stories.@(ts|tsx|mdx)',
    '../src/main/tabs/home/**/*.stories.@(ts|tsx|mdx)',
    '../src/main/tabs/chat/**/*.stories.@(ts|tsx|mdx)',
    '../src/main/tabs/matching/**/*.stories.@(ts|tsx|mdx)',
    '../src/main/tabs/roommate-list/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: ['@storybook/addon-docs'],
  staticDirs: [],
};

export default config;
