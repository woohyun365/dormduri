import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTH_METRIC_DEFINITIONS } from '../../../src/auth/observability/auth-metric.definitions.js';
import { AUTH_CLEANUP_METRIC_DEFINITIONS } from '../../../src/auth/operations/cleanup/auth-cleanup-metric.definitions.js';
import { CHAT_REALTIME_METRIC_DEFINITIONS } from '../../../src/chat/realtime/chat-realtime-metric.definitions.js';
import { HEALTH_METRIC_DEFINITIONS } from '../../../src/health/health-metric.definitions.js';
import { PRISMA_METRIC_DEFINITIONS } from '../../../src/platform/database/prisma-metric.definitions.js';
import { RETENTION_METRIC_DEFINITIONS } from '../../../src/retention/observability/retention-metric.definitions.js';
import { ROOMMATE_SEARCH_METRIC_DEFINITIONS } from '../../../src/roommate-search/observability/roommate-search-metric.definitions.js';
import { SEASON_METRIC_DEFINITIONS } from '../../../src/seasons/operations/season-metric.definitions.js';

const sourceRoot = join(process.cwd(), 'src');
const ownerDefinitions = [
  ...AUTH_METRIC_DEFINITIONS,
  ...AUTH_CLEANUP_METRIC_DEFINITIONS,
  ...CHAT_REALTIME_METRIC_DEFINITIONS,
  ...HEALTH_METRIC_DEFINITIONS,
  ...PRISMA_METRIC_DEFINITIONS,
  ...RETENTION_METRIC_DEFINITIONS,
  ...ROOMMATE_SEARCH_METRIC_DEFINITIONS,
  ...SEASON_METRIC_DEFINITIONS,
];

describe('Platform metric definition ownership', () => {
  it('keeps every product metric definition with its owning domain', () => {
    const definedNames = ownerDefinitions.map(({ name }) => name).sort();
    const recordedNames = productionTypeScriptFiles(sourceRoot)
      .filter((path) => !path.endsWith('metric.definitions.ts'))
      .flatMap((path) => [
        ...readFileSync(path, 'utf8').matchAll(/name:\s*['"](api_[a-z0-9_]+)['"]/gu),
      ])
      .map((match) => match[1]!)
      .filter((name) => !name.startsWith('api_http_') && name !== 'api_exceptions_total')
      .filter((name, index, names) => names.indexOf(name) === index)
      .sort();

    expect(recordedNames).toEqual(definedNames);
    expect(new Set(definedNames).size).toBe(definedNames.length);
  });

  it('keeps platform-owned definitions limited to database infrastructure', () => {
    expect(PRISMA_METRIC_DEFINITIONS.map(({ name }) => name).sort()).toEqual([
      'api_prisma_pool_connections',
      'api_prisma_transaction_retries_total',
    ]);

    const platformDefinitionFiles = productionTypeScriptFiles(join(sourceRoot, 'platform'))
      .filter((path) => path.endsWith('metric.definitions.ts'))
      .map((path) => path.slice(sourceRoot.length + 1).replaceAll('\\', '/'))
      .sort();
    expect(platformDefinitionFiles).toEqual(['platform/database/prisma-metric.definitions.ts']);
  });

  it('keeps the Prometheus adapter free of product metric vocabulary', () => {
    const adapter = readFileSync(
      join(sourceRoot, 'platform/observability/metrics/domain-prometheus-metrics.service.ts'),
      'utf8',
    );

    expect(adapter).not.toMatch(/api_(?:auth|chat|health|realtime|retention|roommate|seasons)_/u);
  });
});

function productionTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return productionTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}
