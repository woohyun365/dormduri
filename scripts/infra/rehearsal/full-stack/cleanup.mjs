// The run builds exactly two images tagged `full-stack-<run id>`. Cleanup removes only those two references
// (never `--rmi all` or a prune, which would also remove nginx, PostgreSQL and observability base images).
export function runImageReferences({ apiConfig, webConfig, runId }) {
  const tag = `full-stack-${runId}`;
  const references = [apiConfig?.services?.api?.image, webConfig?.services?.web?.image];
  for (const reference of references) {
    if (typeof reference !== 'string' || !reference.endsWith(`:${tag}`)) {
      throw new Error(
        `Full-stack image ${reference ?? 'missing'} is not tagged for this run (${tag}).`,
      );
    }
  }
  return references;
}

export function assertReusableImages(images, { imageExists }) {
  const missing = images.filter((image) => !imageExists(image));
  if (missing.length > 0) {
    throw new Error(
      `FULL_STACK_REHEARSAL_SKIP_BUILD=1 reuses only the images of an earlier FULL_STACK_REHEARSAL_KEEP=1 run with the same FULL_STACK_REHEARSAL_RUN_ID; missing ${missing.join(', ')}. Run without SKIP_BUILD to build them.`,
    );
  }
}

// A failed SKIP_BUILD reuse check must not remove the kept run's image that is still there.
export function keepRunImages(images, { imageExists }) {
  const result = { kept: [], removed: [], absent: [], failed: [] };
  for (const image of images) (imageExists(image) ? result.kept : result.absent).push(image);
  return result;
}

export function removeRunImages(images, { imageExists, removeImage }) {
  const result = { kept: [], removed: [], absent: [], failed: [] };
  for (const image of images) {
    if (!imageExists(image)) result.absent.push(image);
    else if (removeImage(image)) result.removed.push(image);
    else result.failed.push(image);
  }
  return result;
}

export function cleanupRehearsal({
  evidence,
  keepRunning,
  apiComposeArguments,
  webComposeArguments,
  safeComposeDown,
  cleanupNetworks,
  noProjectResourcesRemain,
  countProjectResources,
  recordScenario,
  runImages = [],
  removeImages = () => ({ kept: [], removed: [], absent: [], failed: [] }),
}) {
  evidence.cleanup.attempted = true;
  if (keepRunning) {
    evidence.cleanup.images = { kept: [...runImages], removed: [], absent: [], failed: [] };
    return;
  }
  if (!apiComposeArguments || !webComposeArguments) {
    evidence.cleanup.firstPass = true;
    evidence.cleanup.secondPass = true;
    evidence.cleanup.resourcesRemaining = 0;
    evidence.cleanup.images = removeImages();
    return;
  }

  const cleanupPass = () => {
    safeComposeDown(webComposeArguments, 'Web cleanup');
    safeComposeDown(apiComposeArguments, 'API cleanup');
    cleanupNetworks();
  };
  cleanupPass();
  evidence.cleanup.firstPass = noProjectResourcesRemain();
  cleanupPass();
  evidence.cleanup.secondPass = noProjectResourcesRemain();
  evidence.cleanup.resourcesRemaining = evidence.cleanup.secondPass ? 0 : countProjectResources();
  if (evidence.cleanup.firstPass && evidence.cleanup.secondPass) {
    recordScenario('cleanup-idempotency', 'pass', 'two cleanup passes left no project resources');
  } else {
    recordScenario('cleanup-idempotency', 'fail', 'project resources remain after cleanup');
  }
  // Image removal failures are recorded and do not fail the run; the runbook lists what remains.
  evidence.cleanup.images = removeImages();
}
