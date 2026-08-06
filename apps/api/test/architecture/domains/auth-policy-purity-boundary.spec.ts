import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apiSourceRoot,
  authRoot,
  offendingFiles,
  productionTypeScriptFiles,
  readSource,
  relativeSourcePath,
} from './auth-boundary.support.js';

describe('Auth policy purity boundary', () => {
  it('policy/domain helper는 Nest provider와 Prisma client에서 독립적이다', () => {
    const roots = [
      'domain',
      'sessions',
      'verification',
      'credentials',
      'login-attempts',
      'security-events',
    ];
    const files = roots.flatMap((directory) =>
      productionTypeScriptFiles(join(authRoot, directory)).filter(
        (path) => directory === 'domain' || basename(path).endsWith('.policy.ts'),
      ),
    );
    const forbidden = /from\s+['"]@nestjs\/|from\s+['"].*platform\/database|\bPrismaService\b/;

    expect(
      files
        .filter((path) => forbidden.test(readSource(path)))
        .map(relativeSourcePath)
        .sort(),
    ).toEqual([]);
  });

  it('JWT transport와 forwardRef boundary workaround를 사용하지 않는다', () => {
    expect(
      offendingFiles(authRoot, /\bJwtModule\b|\bJwtService\b|from\s+['"]@nestjs\/jwt['"]/),
    ).toEqual([]);
    expect(offendingFiles(apiSourceRoot, /\bforwardRef\s*\(/)).toEqual([]);
  });

  it('auth cleanup은 audit log 재조회 기반 alert aggregation을 소유하지 않는다', () => {
    const cleanupSource = readSource(
      `${authRoot}/operations/cleanup/auth-operational-cleanup.service.ts`,
    );
    const moduleSource = readSource(`${authRoot}/operations/auth-operations.module.ts`);

    expect(cleanupSource).not.toContain('evaluateAuthSecurityEventAlerts');
    expect(cleanupSource).not.toContain('AuthSecurityAlertRepository');
    expect(moduleSource).not.toContain('AuthSecurityAlertRepository');
  });
});
