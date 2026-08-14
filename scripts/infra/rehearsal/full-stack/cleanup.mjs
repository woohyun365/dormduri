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
}) {
  evidence.cleanup.attempted = true;
  if (keepRunning) return;
  if (!apiComposeArguments || !webComposeArguments) {
    evidence.cleanup.firstPass = true;
    evidence.cleanup.secondPass = true;
    evidence.cleanup.resourcesRemaining = 0;
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
}
