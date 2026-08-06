import { describe, expect, it } from 'vitest';
import {
  authRoot,
  productionTypeScriptFiles,
  readSource,
  relativeSourcePath,
} from './auth-boundary.support.js';

describe('Auth composition boundary', () => {
  it('AuthService는 controller-facing use-case facade로 유지된다', () => {
    const source = readSource(`${authRoot}/application/auth.service.ts`);
    const forbidden = [
      /\bAuthUseCases\b/,
      /\bPrismaService\b/,
      /\bprisma:\s*this\.prisma\b/,
      /\bAuthSessionService\b/,
      /\bAuthVerificationService\b/,
      /\bAuthLoginAttemptService\b/,
      /\bAuthSecurityEventService\b/,
    ];

    expect(forbidden.filter((pattern) => pattern.test(source))).toEqual([]);
    expect(source).toContain('AuthVerificationUseCases');
    expect(source).toContain('AuthRegistrationUseCases');
    expect(source).toContain('AuthCredentialUseCases');
    expect(source).toContain('AuthSessionUseCases');
  });

  it('Nest module은 HTTP와 operations composition boundary로 제한된다', () => {
    const modules = productionTypeScriptFiles(authRoot)
      .filter((path) => /@Module\s*\(/.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(modules).toEqual([
      'src/auth/auth.module.ts',
      'src/auth/operations/auth-operations.module.ts',
    ]);
  });

  it('global guard는 login throttle 뒤에 authentication을 적용한다', () => {
    const source = readSource(`${authRoot}/composition/auth.providers.ts`);
    const throttleIndex = source.indexOf('useClass: AuthLoginThrottlerGuard');
    const authenticatedIndex = source.indexOf('useClass: AuthenticatedUserGuard');

    expect(throttleIndex).toBeGreaterThan(-1);
    expect(authenticatedIndex).toBeGreaterThan(throttleIndex);
  });

  it('AuthOperationsModule은 non-global이며 public operations capability만 export한다', () => {
    const source = readSource(`${authRoot}/operations/auth-operations.module.ts`);
    const exportsBlock = source.match(/exports:\s*\[([\s\S]*?)\]/)?.[1] ?? '';

    expect(source).not.toContain('@Global');
    expect(exportsBlock).toContain('AuthOperationalCleanupService');
    expect(exportsBlock).toContain('AuthOperationsHealthService');
    expect(exportsBlock).not.toContain('AuthCleanupMetricsService');
  });
});
