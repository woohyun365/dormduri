import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const apiArchitectureTestRoot = join(apiRoot, 'test/architecture');
const authRoot = join(apiSourceRoot, 'auth');

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

function walkDirectories(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) {
      return [];
    }
    const path = join(root, entry.name);
    return [path, ...walkDirectories(path)];
  });
}

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function offendingFiles(root: string, forbidden: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => forbidden.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

describe('Auth product architecture boundary', () => {
  it('keeps external production code away from auth internal implementation directories', () => {
    const forbiddenAuthInternalImports =
      /from\s+['"].*(?:\.\.\/)+auth\/(?:commands|repositories|domain|policies|adapters|sessions|verification|credentials|registration|login-attempts|security-events)(?:\/[^'"]*)?(?:\.js)?['"]/;

    const externalSourceRoots = readdirSync(apiSourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'auth' && entry.name !== 'generated')
      .map((entry) => join(apiSourceRoot, entry.name));

    const offenders = externalSourceRoots.flatMap((root) =>
      offendingFiles(root, forbiddenAuthInternalImports),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps AuthService as a controller-facing facade without infrastructure ownership', () => {
    const source = readSource(join(authRoot, 'application/auth.service.ts'));
    const forbiddenFacadeResponsibilities = [
      ['AuthUseCases bucket dependency', /\bAuthUseCases\b/],
      ['PrismaService dependency', /\bPrismaService\b/],
      ['command Prisma dependency forwarding', /\bprisma:\s*this\.prisma\b/],
      ['session internals dependency', /\bAuthSessionService\b/],
      ['verification internals dependency', /\bAuthVerificationService\b/],
      ['login-attempt internals dependency', /\bAuthLoginAttemptService\b/],
      ['security-event write dependency', /\bAuthSecurityEventService\b/],
    ] as const;

    const offenders = forbiddenFacadeResponsibilities
      .filter(([, forbidden]) => forbidden.test(source))
      .map(([label]) => label);

    expect(offenders).toEqual([]);
    expect(source).toContain('AuthVerificationUseCases');
    expect(source).toContain('AuthRegistrationUseCases');
    expect(source).toContain('AuthCredentialUseCases');
    expect(source).toContain('AuthSessionUseCases');
  });

  it('keeps external domains on the public auth import surface or explicit operations boundary', () => {
    const finalAllowedExternalAuthImports = [
      /(?:^|\/)auth\/auth\.module(?:\.js)?$/,
      /(?:^|\/)auth\/access\/[^'"]+(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-actor-context[^'"]*(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-password-verifier\.service(?:\.js)?$/,
    ];
    const operationsAllowedExternalAuthImports = [
      /(?:^|\/)auth\/operations\/cleanup\/auth-operational-cleanup\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/health\/auth-operations-health\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/auth-operations\.module(?:\.js)?$/,
    ];
    const allowedExternalAuthImports = [
      ...finalAllowedExternalAuthImports,
      ...operationsAllowedExternalAuthImports,
    ];

    const externalSourceRoots = readdirSync(apiSourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'auth' && entry.name !== 'generated')
      .map((entry) => join(apiSourceRoot, entry.name));

    const unapprovedImports = externalSourceRoots.flatMap((root) =>
      productionTypeScriptFiles(root).flatMap((path) =>
        importSpecifiers(readSource(path))
          .filter((specifier) => /(?:^|\/)auth\//.test(specifier))
          .filter(
            (specifier) => !allowedExternalAuthImports.some((allowed) => allowed.test(specifier)),
          )
          .map((specifier) => `${relativeSourcePath(path)} -> ${specifier}`),
      ),
    );

    expect(unapprovedImports.sort()).toEqual([]);
  });

  it('exposes password verification as a public capability instead of raw hash functions', () => {
    expect(existsSync(join(authRoot, 'application/auth-password-hash.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'application/auth-password-verifier.service.ts'))).toBe(true);

    const verifierSource = readSource(
      join(authRoot, 'application/auth-password-verifier.service.ts'),
    );
    expect(verifierSource).toContain('verifyAccountPassword');
    expect(verifierSource).not.toContain('export { hashPassword');
  });

  it('keeps generic auth utilities dissolved into explicit owners', () => {
    expect(existsSync(join(authRoot, 'domain/auth.utils.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'domain/auth-email-identity.policy.ts'))).toBe(true);
    expect(existsSync(join(authRoot, 'verification/challenge/verification-code.crypto.ts'))).toBe(
      true,
    );
    expect(
      existsSync(join(authRoot, 'verification/request/auth-verification-timing.policy.ts')),
    ).toBe(true);
  });

  it('keeps cross-slice auth type and flow metric buckets removed', () => {
    expect(existsSync(join(authRoot, 'domain/auth.types.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'operations/auth-flow-metrics.service.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'verification/verification-code.repository.ts'))).toBe(false);
    expect(offendingFiles(authRoot, /\bAuthVerificationStore\b/)).toEqual([]);
  });

  it('keeps auth Nest modules limited to the HTTP and operations composition boundaries', () => {
    const moduleFiles = productionTypeScriptFiles(authRoot)
      .filter((path) => /@Module\s*\(/.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(moduleFiles).toEqual([
      'src/auth/auth.module.ts',
      'src/auth/operations/auth-operations.module.ts',
    ]);
  });

  it('keeps global auth guard registration ordered from login throttle to authentication', () => {
    const source = readSource(join(authRoot, 'composition/auth.providers.ts'));
    const throttleGuardIndex = source.indexOf('useClass: AuthLoginThrottlerGuard');
    const authenticatedGuardIndex = source.indexOf('useClass: AuthenticatedUserGuard');

    expect(throttleGuardIndex).toBeGreaterThan(-1);
    expect(authenticatedGuardIndex).toBeGreaterThan(throttleGuardIndex);
  });

  it('keeps password policy fitness under the architecture owner', () => {
    expect(
      existsSync(join(apiArchitectureTestRoot, 'domains/auth-password-policy-boundary.spec.ts')),
    ).toBe(true);
    expect(existsSync(join(authRoot, 'credentials/password-policy.boundary.spec.ts'))).toBe(false);
  });

  it('keeps external production code off shared auth policy ownership', () => {
    const externalSourceRoots = readdirSync(apiSourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'auth' && entry.name !== 'generated')
      .map((entry) => join(apiSourceRoot, entry.name));

    const sharedAuthPolicyConsumers = externalSourceRoots.flatMap((root) =>
      productionTypeScriptFiles(root)
        .filter((path) => /from\s+['"]@repo\/shared\/auth\/policy['"]/.test(readSource(path)))
        .map(relativeSourcePath),
    );

    expect(sharedAuthPolicyConsumers.sort()).toEqual([]);
  });

  it('keeps optional auth controller routes away from direct Authorization header parsing', () => {
    const source = readSource(join(authRoot, 'auth.controller.ts'));

    expect(source).not.toContain("@Headers('authorization')");
    expect(source).not.toContain('headers.authorization');
    expect(source).not.toContain("startsWith('Bearer ')");
  });

  it('keeps policy/domain helpers pure from Nest providers and Prisma clients', () => {
    const purePolicyOrDomainRoots = [
      'domain',
      'sessions',
      'verification',
      'credentials',
      'login-attempts',
      'security-events',
    ];
    const purePolicyOrDomainFiles = purePolicyOrDomainRoots.flatMap((directory) => {
      const root = join(authRoot, directory);
      return productionTypeScriptFiles(root).filter(
        (path) => directory === 'domain' || basename(path).endsWith('.policy.ts'),
      );
    });
    const forbiddenImpureImports =
      /from\s+['"]@nestjs\/|from\s+['"].*common\/prisma\/prisma\.service|PrismaService\b/;
    const offenders = purePolicyOrDomainFiles
      .filter((path) => forbiddenImpureImports.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('does not reintroduce JWT transport or Nest forwardRef boundary workarounds', () => {
    expect(
      offendingFiles(authRoot, /\bJwtModule\b|\bJwtService\b|from\s+['"]@nestjs\/jwt['"]/),
    ).toEqual([]);
    expect(offendingFiles(apiSourceRoot, /\bforwardRef\s*\(/)).toEqual([]);
  });

  it('keeps AuthOperationsModule non-global and imported only through explicit operation boundaries', () => {
    const source = readSource(join(authRoot, 'operations/auth-operations.module.ts'));

    expect(source).not.toContain('@Global');
    expect(source).toContain('exports: [');
    expect(source).toContain('AuthOperationalCleanupService');
    expect(source).toContain('AuthOperationsHealthService');
    const exportsBlock = source.match(/exports:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    expect(exportsBlock).not.toContain('AuthCleanupMetricsService');
  });

  it('keeps auth retention cleanup free from audit-log alert aggregation', () => {
    const cleanupSource = readSource(
      join(authRoot, 'operations/cleanup/auth-operational-cleanup.service.ts'),
    );
    const moduleSource = readSource(join(authRoot, 'operations/auth-operations.module.ts'));

    expect(cleanupSource).not.toContain('evaluateAuthSecurityEventAlerts');
    expect(cleanupSource).not.toContain('AuthSecurityAlertRepository');
    expect(moduleSource).not.toContain('AuthSecurityAlertRepository');
  });

  it('keeps grant consumption on its explicit owner and removes the ambiguous proof helper', () => {
    expect(existsSync(join(authRoot, 'verification/auth-verification-proof.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'verification/grant/verification-grant-consumption.ts'))).toBe(
      true,
    );
  });

  it('keeps verification and login admission files on lifecycle-owned paths', () => {
    const expectedLifecycleOwners = [
      'verification/request/auth-verification-request.repository.ts',
      'verification/challenge/auth-verification-challenge.repository.ts',
      'verification/grant/auth-verification-grant.repository.ts',
      'login-attempts/account-lock/auth-login-attempt.service.ts',
      'login-attempts/account-lock/login-attempt.repository.ts',
      'login-attempts/network-throttle/auth-login-throttler.guard.ts',
      'login-attempts/network-throttle/auth-throttle.options.ts',
    ];
    const removedAmbiguousOwners = [
      'verification/verification-code.repository.ts',
      'verification/auth-verification-request.repository.ts',
      'login-attempts/auth-login-attempt.service.ts',
      'login-attempts/auth-login-throttler.guard.ts',
    ];

    expect(expectedLifecycleOwners.filter((path) => !existsSync(join(authRoot, path)))).toEqual([]);
    expect(removedAmbiguousOwners.filter((path) => existsSync(join(authRoot, path)))).toEqual([]);

    const forbiddenTechnicalLayerDirectories = ['commands', 'queries', 'repositories'];
    const lifecycleRoots = [join(authRoot, 'verification'), join(authRoot, 'login-attempts')];
    const offenders = lifecycleRoots.flatMap((root) =>
      forbiddenTechnicalLayerDirectories
        .map((directory) => join(root, directory))
        .filter(existsSync)
        .map(relativeSourcePath),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps account lock and network throttle state owners independent', () => {
    const accountLockRoot = join(authRoot, 'login-attempts/account-lock');
    const networkThrottleRoot = join(authRoot, 'login-attempts/network-throttle');
    const accountLockImports = productionTypeScriptFiles(accountLockRoot).flatMap((path) =>
      importSpecifiers(readSource(path)),
    );
    const networkThrottleImports = productionTypeScriptFiles(networkThrottleRoot).flatMap((path) =>
      importSpecifiers(readSource(path)),
    );

    expect(
      accountLockImports.filter((specifier) => specifier.includes('network-throttle')),
    ).toEqual([]);
    expect(
      networkThrottleImports.filter((specifier) => specifier.includes('account-lock')),
    ).toEqual([]);
  });

  it('keeps cohesive session, mail, and security-event lifecycles free from technical layers', () => {
    const cohesiveLifecycleRoots = ['sessions', 'mail', 'security-events'].map((directory) =>
      join(authRoot, directory),
    );
    const forbiddenTechnicalLayers = new Set(['commands', 'queries', 'repositories', 'services']);
    const offenders = cohesiveLifecycleRoots
      .flatMap(walkDirectories)
      .filter((path) => forbiddenTechnicalLayers.has(basename(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps /health/auth as an ops-only protected capability route', () => {
    const healthController = readSource(join(apiSourceRoot, 'health/health.controller.ts'));
    const routeBlock =
      healthController.match(/@Get\('auth'\)[\s\S]*?getAuthOperations\(/)?.[0] ?? '';

    expect(routeBlock).toContain("@RequireCapability('admin:operations:health:read')");
    expect(routeBlock).not.toContain('@Public()');
  });

  it('keeps /health/realtime as an ops-only protected capability route', () => {
    const healthController = readSource(join(apiSourceRoot, 'health/health.controller.ts'));
    const routeBlock =
      healthController.match(/@Get\('realtime'\)[\s\S]*?getRealtimeOperations\(/)?.[0] ?? '';

    expect(routeBlock).toContain("@RequireCapability('admin:operations:health:read')");
    expect(routeBlock).not.toContain('@Public()');
  });
});
