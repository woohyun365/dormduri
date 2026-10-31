import { readFileSync } from 'node:fs';
import type { PluginOptions } from 'babel-plugin-react-compiler';
import type { NextConfig } from 'next';

type NextReactCompilerOptions = Exclude<NextConfig['reactCompiler'], boolean | undefined>;

// The single source of React Compiler options. next.config.ts passes them to `reactCompiler`, and vitest.config.ts and
// .storybook/main.ts pass them to `reactCompilerPreset` so tests and stories run the same compiled code as production.
// - compilationMode 'infer': compile every function the compiler recognizes as a component or Hook.
// - panicThreshold 'none': skip a component the compiler cannot compile instead of failing the build; the compiler lint
//   rules (eslint-config-next) already fail CI on Rules of React violations.
// - enablePreserveExistingMemoizationGuarantees: keep the existing useMemo/useCallback guarantees; the Next.js docs ask
//   to set it explicitly because the default can differ between compiler versions.
export const reactCompilerOptions = {
  compilationMode: 'infer',
  panicThreshold: 'none',
  environment: {
    enablePreserveExistingMemoizationGuarantees: true,
  },
} as const satisfies NextReactCompilerOptions & PluginOptions;

// Test, story and fixture code (and the Storybook config). Next.js never builds it, so it stays as written around the
// compiled components. Matched from the app `src/` directory so the checkout path itself never matches.
const harnessFile =
  /\/(?:__tests__|__stories__|__fixtures__|stories|test-support|test)\/|\.(?:test|spec|stories)\.[cm]?[jt]sx?$/u;
const useClientDirective = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use client['"]/u;

// Next.js runs React Compiler only on the browser bundle (its loader skips the server layers and node_modules), so App
// Router modules without 'use client' (server pages and layouts) are never compiled. Vitest and Storybook build every
// file for one client environment, so they apply the same scope through the compiler `sources` option;
// @rolldown/plugin-babel already skips node_modules.
export function isCompiledByNextBrowserBuild(filename: string): boolean {
  const path = (filename.split('?')[0] ?? filename).replaceAll('\\', '/');
  if (path.includes('/.storybook/')) return false;
  const srcIndex = path.lastIndexOf('/src/');
  if (srcIndex === -1) return true;
  const fromSrc = path.slice(srcIndex);
  if (harnessFile.test(fromSrc)) return false;
  if (fromSrc.startsWith('/src/app/')) return useClientDirective.test(readFileSync(path, 'utf8'));
  return true;
}

// The options vitest.config.ts and .storybook/main.ts pass to `reactCompilerPreset`: the same values plus that scope.
export const reactCompilerViteOptions = {
  ...reactCompilerOptions,
  sources: isCompiledByNextBrowserBuild,
} satisfies PluginOptions;
