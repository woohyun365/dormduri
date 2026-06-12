import swc from 'unplugin-swc';
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

const swcPlugin = swc.vite({
  module: { type: 'es6' },
  jsc: {
    parser: {
      syntax: 'typescript',
      decorators: true,
    },
    transform: {
      decoratorMetadata: true,
    },
    target: 'es2022',
  },
});

const baseConfig = defineConfig({
  plugins: [swcPlugin],
  oxc: false,
  test: {
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
  resolve: {
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
  },
});

export function defineApiVitestConfig(config: ViteUserConfig) {
  return mergeConfig(baseConfig, defineConfig(config));
}
