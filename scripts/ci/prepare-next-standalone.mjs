import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function requireDirectory(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} artifact가 없습니다: ${path}`);
  }
}

const defaultWebRoot = fileURLToPath(new URL('../../apps/web/', import.meta.url));

export function prepareNextStandalone(webRoot = defaultWebRoot) {
  const nextRoot = resolve(webRoot, '.next');
  const standaloneAppRoot = resolve(nextRoot, 'standalone/apps/web');
  const staticSource = resolve(nextRoot, 'static');
  const publicSource = resolve(webRoot, 'public');
  const staticTarget = resolve(standaloneAppRoot, '.next/static');
  const publicTarget = resolve(standaloneAppRoot, 'public');

  requireDirectory(standaloneAppRoot, 'Next standalone');
  requireDirectory(staticSource, 'Next static');
  requireDirectory(publicSource, 'Web public');

  rmSync(staticTarget, { recursive: true, force: true });
  rmSync(publicTarget, { recursive: true, force: true });
  mkdirSync(resolve(standaloneAppRoot, '.next'), { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
  cpSync(publicSource, publicTarget, { recursive: true });

  return { standaloneAppRoot, staticTarget, publicTarget };
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const webRootArgument = process.argv.find((argument) => argument.startsWith('--web-root='));
  const webRoot = webRootArgument?.slice('--web-root='.length);
  const result = prepareNextStandalone(webRoot ? resolve(webRoot) : undefined);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
