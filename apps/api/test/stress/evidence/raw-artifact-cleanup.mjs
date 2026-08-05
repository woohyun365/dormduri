import { existsSync, rmSync } from 'node:fs';

export function cleanupRawStressArtifacts(artifactPaths) {
  for (const artifactPath of artifactPaths) {
    if (existsSync(artifactPath)) {
      rmSync(artifactPath, { force: true });
    }
  }
}
