import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const metricsRoot = join(apiRoot, 'src/platform/observability/metrics');

const forbiddenLabelNames = [
  'actorHash',
  'authorization',
  'body',
  'cookie',
  'correlationId',
  'email',
  'ip',
  'messageId',
  'params',
  'password',
  'path',
  'payload',
  'query',
  'rawPath',
  'requestBody',
  'requestId',
  'sessionId',
  'threadId',
  'token',
  'userId',
];

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function relativeApiPath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

describe('API metrics boundary', () => {
  it('keeps metric definitions on bounded labels only', () => {
    const offenders = walkTypeScriptFiles(metricsRoot)
      .filter((path) => !path.endsWith('.spec.ts'))
      .filter((path) => !path.endsWith('metric-label.policy.ts'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return forbiddenLabelNames.some((labelName) => {
          const labelPattern = new RegExp(`["']${labelName}["']`);
          return labelPattern.test(source);
        });
      })
      .map(relativeApiPath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps metrics endpoint under internal path with bearer guard', () => {
    const controller = readFileSync(join(metricsRoot, 'metrics.controller.ts'), 'utf8');
    const guard = readFileSync(join(metricsRoot, 'metrics-auth.guard.ts'), 'utf8');

    expect(controller).toContain('@Controller(DEFAULT_METRICS_ROUTE)');
    expect(controller).toContain('@UseGuards(MetricsAuthGuard)');
    expect(guard).toContain('METRICS_BEARER_TOKEN');
    expect(guard).toContain('UnauthorizedException');
  });
});
