import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FULL_CHECK = ['.', '-c'];
const CHANGED_CHECK = ['-c', '--ignore-unknown', '--'];

function isRegularFile(path, cwd) {
  try {
    return lstatSync(resolve(cwd, path)).isFile();
  } catch {
    return false;
  }
}

// Returns the Prettier arguments for the scope chosen by classify-changes.mjs, or null when no changed file is left
// to check. Anything but a well-formed, non-empty `changed` scope falls back to the full check. Deleted paths and the
// source of a rename no longer exist in the checkout, so only regular files that do are passed; --ignore-unknown
// skips files Prettier has no parser for, as the directory expansion of the full check does.
export function prettierArguments({ scope, pathsJson, cwd = process.cwd() }) {
  if (scope !== 'changed') {
    return FULL_CHECK;
  }

  let paths;
  try {
    paths = JSON.parse(pathsJson ?? '');
  } catch {
    return FULL_CHECK;
  }
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    !paths.every((path) => typeof path === 'string' && path)
  ) {
    return FULL_CHECK;
  }

  const existing = paths.filter((path) => isRegularFile(path, cwd));
  return existing.length === 0 ? null : [...CHANGED_CHECK, ...existing];
}

export function checkFormatting({
  scope = process.env.FORMATTING_SCOPE,
  pathsJson = process.env.FORMATTING_PATHS,
  cwd = process.cwd(),
} = {}) {
  const args = prettierArguments({ scope, pathsJson, cwd });
  if (args === null) {
    process.stdout.write('No changed file remains in the checkout; formatting check skipped.\n');
    return 0;
  }

  process.stdout.write(
    args === FULL_CHECK
      ? 'Formatting scope: full\n'
      : `Formatting scope: changed (${args.length - CHANGED_CHECK.length} files)\n`,
  );
  const prettier = createRequire(import.meta.url).resolve('prettier/bin/prettier.cjs');
  const result = spawnSync(process.execPath, [prettier, ...args], { cwd, stdio: 'inherit' });
  return result.status ?? 1;
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  process.exitCode = checkFormatting();
}
