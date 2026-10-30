// Runs the API's TypeScript CLIs and stress tools under Node without a build step: `node --import
// ./test/support/ts-esm-loader.mjs <file>.ts`. Node keeps package resolution, so package `exports` patterns such as
// NestJS's `"./*.js"` resolve as Node defines them. A relative `.js` specifier with no such file falls back to its
// `.ts` source, and `.ts` files outside node_modules are transpiled with the workspace TypeScript using the compiler
// options of apps/api/tsconfig.json, so target and decorator settings keep one owner. Only the module format and
// source map shape are set here. It does not type-check; `pnpm --dir apps/api typecheck:test` covers these files
// because the test tsconfig includes src.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const tsconfigPath = fileURLToPath(new URL('../../tsconfig.json', import.meta.url));
const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, undefined, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(diagnostic) {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  },
});
if (!tsconfig) throw new Error(`Cannot read ${tsconfigPath}`);
const compilerOptions = {
  ...tsconfig.options,
  module: ts.ModuleKind.ESNext,
  inlineSourceMap: true,
  sourceMap: false,
  incremental: false,
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
