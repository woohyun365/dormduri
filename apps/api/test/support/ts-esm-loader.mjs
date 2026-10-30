// Runs the API's TypeScript CLIs and stress tools under Node without a build step: `node --import
// ./test/support/ts-esm-loader.mjs <file>.ts`. Node keeps package resolution, so package `exports` patterns such as
// NestJS's `"./*.js"` resolve as Node defines them. A relative `.js` specifier with no such file falls back to its
// `.ts` source, and `.ts` files outside node_modules are transpiled with the workspace TypeScript using the API's
// decorator settings. It does not type-check; `pnpm --dir apps/api typecheck` owns that.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2023,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  esModuleInterop: true,
  isolatedModules: true,
  inlineSourceMap: true,
};

function isPathSpecifier(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:');
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !isPathSpecifier(specifier)) throw error;
      if (!specifier.endsWith('.js')) throw error;
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    }
  },
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.ts') || url.includes('/node_modules/')) {
      return nextLoad(url, context);
    }
    const fileName = fileURLToPath(url);
    const { outputText } = ts.transpileModule(readFileSync(fileName, 'utf8'), {
      fileName,
      compilerOptions,
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});
