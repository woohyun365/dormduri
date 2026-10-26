import { isAbsolute, relative, resolve, sep } from 'node:path';

import { loadWorkspaceLayout } from './workspace-layout.mjs';

export const DEFAULT_ARTIFACTS_DIRECTORY = '.artifacts/tools';

// Ignored roots that may hold an override: not a root whose tracked files .gitignore alone lists, and not a
// Markdown-only root, because the override receives script output.
function overrideRoots(layout) {
  return layout.roots.filter(
    (root) =>
      root.tracking === 'ignored' && !root.trackedFilesOwner && root.children !== 'markdown-only',
  );
}

// The workspace layout manifest is read only here, under an override. Callers that pass `{}` (host runtime hooks)
// never reach it.
function overrideDirectory(repoRoot, configuredDirectory) {
  const layout = loadWorkspaceLayout();
  const directory = resolve(repoRoot, configuredDirectory);
  const inside = relative(resolve(repoRoot), directory);
  if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return directory;
  const path = inside.split(sep).join('/');
  const roots = overrideRoots(layout);
  const parents = roots.filter((root) => path.startsWith(`${root.path}/`));
  const tracked = parents.some((root) =>
    root.trackedFiles?.some(
      (file) => path === `${root.path}/${file}` || path.startsWith(`${root.path}/${file}/`),
    ),
  );
  if (!parents.length || tracked)
    throw new Error(
      `KNU_ARTIFACTS_DIR must point outside the repository or under an ignored workspace root ` +
        `(${roots.map((root) => `${root.path}/`).join(', ')}): ${configuredDirectory}`,
    );
  return directory;
}

export function resolveArtifactsDirectory(repoRoot, environment = process.env) {
  const configuredDirectory = environment.KNU_ARTIFACTS_DIR?.trim();
  return configuredDirectory
    ? overrideDirectory(repoRoot, configuredDirectory)
    : resolve(repoRoot, DEFAULT_ARTIFACTS_DIRECTORY);
}

// Host runtime kinds stay in the checkout under an override (manifest `overridable: false`).
export function resolveArtifactPath(repoRoot, segments, environment = process.env) {
  const overridden =
    environment.KNU_ARTIFACTS_DIR?.trim() &&
    loadWorkspaceLayout().toolKinds.get(segments[0])?.overridable !== false;
  return resolve(
    overridden
      ? resolveArtifactsDirectory(repoRoot, environment)
      : resolve(repoRoot, DEFAULT_ARTIFACTS_DIRECTORY),
    ...segments,
  );
}
