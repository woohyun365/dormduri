import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HealthController } from '../../../src/health/health.controller.js';
import { expectedRoutes } from '../security/auth-access-route-matrix.fixture.js';

const apiRoot = process.cwd();
const healthModulePath = join(apiRoot, 'src/health/health.module.ts');

describe('API runtime health boundary', () => {
  it('limits health routes to public liveness and readiness', () => {
    const healthRoutes = expectedRoutes
      .filter(({ controller }) => controller === HealthController)
      .map(({ access, handler, path }) => ({ access, handler, path }));

    expect(healthRoutes).toEqual([
      { access: 'public', handler: 'getLiveness', path: 'health' },
      { access: 'public', handler: 'getLive', path: 'health/live' },
      { access: 'public', handler: 'getReadiness', path: 'health/ready' },
    ]);
  });

  it('keeps the runtime probe module independent from product domains', () => {
    const source = readFileSync(healthModulePath, 'utf8');
    const crossSliceImports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/gu)]
      .map((match) => match[1])
      .sort();

    expect(crossSliceImports).toEqual([
      '../platform/database/prisma.module.js',
      '../platform/observability/logging/app-logger.module.js',
      '../platform/observability/metrics/domain-metric-definitions.module.js',
    ]);
  });
});
