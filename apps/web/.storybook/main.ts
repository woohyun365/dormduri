import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  stories: [
    '../src/auth/**/*.stories.@(ts|tsx)',
    '../src/legal/__stories__/**/*.stories.@(ts|tsx)',
    '../src/observability/**/*.stories.@(ts|tsx)',
    '../src/main/tabs/home/**/*.stories.@(ts|tsx)',
    '../src/main/tabs/chat/**/*.stories.@(ts|tsx)',
    '../src/main/tabs/matching/**/*.stories.@(ts|tsx)',
    '../src/main/tabs/roommate-list/**/*.stories.@(ts|tsx)',
    '../src/screens/**/*.stories.@(ts|tsx)',
    '../src/styles/tokens/**/*.stories.@(ts|tsx)',
    // Foundations docs pages (MDX with doc blocks) beside the token samples. Storybook 10 indexes
    // MDX docs as *.mdx; a *.stories.mdx file fails the build.
    '../src/styles/tokens/**/*.mdx',
  ],
  addons: ['@storybook/addon-docs'],
  staticDirs: [],
};

export default config;
