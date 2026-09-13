// Test-only loader for the actual unbundled Web forwarding owners. No product loader/config changes.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire('/workspace/apps/web/package.json');
const ts = require('typescript');
export async function resolve(specifier, context, nextResolve) {
  if (
    specifier.startsWith('@/') ||
    (specifier.startsWith('.') && context.parentURL?.endsWith('.ts'))
  ) {
    const path = specifier.startsWith('@/')
      ? resolvePath('/workspace/apps/web/src', specifier.slice(2))
      : resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    for (const candidate of [path, `${path}.ts`, `${path}/index.ts`])
      if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:'))
      return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
    throw error;
  }
}
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:///workspace/apps/web/src/') && url.endsWith('.ts')) {
    return {
      format: 'module',
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2023,
          module: ts.ModuleKind.ESNext,
          esModuleInterop: true,
        },
      }).outputText,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
