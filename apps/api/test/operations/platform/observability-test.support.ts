import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const apiRoot = process.cwd();
export const repoRoot = join(apiRoot, '../..');
export const observabilityRoot = join(repoRoot, 'infra/observability');
const dashboardsRoot = join(observabilityRoot, 'grafana/dashboards');

export function readInfraFile(relativePath: string): string {
  return readFileSync(join(observabilityRoot, relativePath), 'utf8');
}

export function readDashboardFiles(): Array<{
  path: string;
  source: string;
  parsed: unknown;
}> {
  return readdirSync(dashboardsRoot)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const source = readFileSync(join(dashboardsRoot, name), 'utf8');
      return { path: `grafana/dashboards/${name}`, source, parsed: JSON.parse(source) as unknown };
    });
}

export function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

export function stripCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#') && !line.trimStart().startsWith('//'))
    .join('\n');
}
