import { mkdirSync, writeFileSync } from 'node:fs';

export function sanitizeFailure(error, secretValues) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secretValues) message = message.replaceAll(secret, '[redacted]');
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/giu, '[redacted-database-url]');
}

export function writeRehearsalEvidence({
  evidence,
  evidenceDirectory,
  evidenceJsonPath,
  evidenceMarkdownPath,
  secretValues,
  assert,
}) {
  mkdirSync(evidenceDirectory, { recursive: true });
  evidence.completedAt = new Date().toISOString();
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  for (const secret of secretValues) {
    assert(!serialized.includes(secret), 'Secret value reached rehearsal evidence.');
  }
  assert(!/postgres(?:ql)?:\/\//iu.test(serialized), 'Database URL reached rehearsal evidence.');
  writeFileSync(evidenceJsonPath, serialized);
  writeFileSync(evidenceMarkdownPath, renderMarkdownEvidence(evidence));
}

export function renderMarkdownEvidence(result) {
  const scenarioRows = result.scenarios
    .map((scenario) => `| ${scenario.name} | ${scenario.status} | ${scenario.detail} |`)
    .join('\n');
  const resourceRows = result.resourceHighWater
    .map(
      (resource) =>
        `| ${resource.name} | ${resource.cpuPercent}% | ${resource.memoryUsage} | ${resource.memoryPercent}% | ${resource.pids} |`,
    )
    .join('\n');
  return `# Full-stack local infrastructure rehearsal\n\n- Run: \`${result.runId}\`\n- Status: \`${result.status}\`\n- Started: ${result.startedAt}\n- Completed: ${result.completedAt}\n- Docker engine: ${result.envelope?.cpus ?? '?'} CPU / ${result.envelope?.memoryMiB ?? '?'}MiB\n- Product envelope: ${result.envelope?.productEnvelopeMiB ?? '?'}MiB\n- Product container limits: ${result.envelope?.productContainerLimitMiB ?? '?'}MiB\n- Local PostgreSQL allowance: ${result.envelope?.databaseAllowanceMiB ?? '?'}MiB\n- Engine headroom after limits: ${result.envelope?.engineHeadroomMiB ?? '?'}MiB\n- Database mode: \`${result.databaseMode}\`\n- Blocker: ${result.blocker ?? 'none'}\n\n## Scenario results\n\n| Scenario | Status | Detail |\n| --- | --- | --- |\n${scenarioRows}\n\n## Resource high-water samples\n\n| Container | CPU | Memory | Memory % | PIDs |\n| --- | ---: | --- | ---: | ---: |\n${resourceRows || '| none | | | | |'}\n\n## Cleanup\n\n- First pass: ${result.cleanup.firstPass}\n- Second pass: ${result.cleanup.secondPass}\n- Remaining resources: ${result.cleanup.resourcesRemaining}\n- Run images: ${renderImageCleanup(result.cleanup.images)}\n\nThis local result does not replace production target evidence.\n`;
}

function renderImageCleanup(images) {
  if (!images) return 'not recorded';
  return ['kept', 'removed', 'absent', 'failed']
    .map((state) => `${state} ${images[state].map((image) => `\`${image}\``).join(', ') || 'none'}`)
    .join('; ');
}
