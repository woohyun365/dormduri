import babel from '@rolldown/plugin-babel';
import type { StorybookConfig } from '@storybook/nextjs-vite';
import { reactCompilerPreset } from '@vitejs/plugin-react';
// Storybook's main.ts loader maps a '.js' relative import to the '.ts' file. Without an extension it reads '.config' as
// the extension and the import does not resolve.
import { reactCompilerViteOptions } from '../react-compiler.config.js';

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
  // @storybook/nextjs-vite reads next.config.ts but does not apply its reactCompiler option, so stories add the same
  // compiler options and file scope (react-compiler.config.ts) as a Vite plugin and render the code the Next.js browser
  // build produces. The plugin goes first: both it and the framework SWC transform are `enforce: 'pre'`, and the
  // compiler has to see the source JSX (as in the Next.js build) to recognize components that call no Hook.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [
      babel({ presets: [reactCompilerPreset(reactCompilerViteOptions)] }),
      ...(viteConfig.plugins ?? []),
    ],
  }),
};

export default config;
