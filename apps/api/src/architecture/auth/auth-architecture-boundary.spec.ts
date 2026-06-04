import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const authRoot = join(apiSourceRoot, 'auth');

const finalRootProductionFiles = ['auth.controller.ts', 'auth.module.ts'];

const removedRootCompatibilityFiles = [
  'auth-access.decorator.ts',
  'auth-password.ts',
  'auth-capability.ts',
  'auth-change-password-owner.ts',
  'auth-failures.ts',
  'auth-login-attempt.service.ts',
  'auth-login-owner.ts',
  'auth-reset-password-owner.ts',
  'auth-response.builder.ts',
  'auth-security-alert.policy.ts',
  'auth-security-event.service.ts',
  'auth-security-event.types.ts',
  'auth-signup-owner.ts',
  'auth-signup-validation.service.ts',
  'auth-user-view.ts',
  'auth-verification-lock.ts',
  'auth-verification-proof.ts',
  'auth-verification.service.ts',
  'auth-verification.store.ts',
  'auth.errors.ts',
  'auth.service.ts',
  'authenticated-user.decorator.ts',
  'authenticated-user.guard.ts',
  'email-sender.interface.ts',
  'monitored-email-sender.service.ts',
  'stub-email-sender.service.ts',
  'auth-request-context.ts',
  'auth-session.service.ts',
  'auth.constants.ts',
  'auth.types.ts',
  'auth.utils.ts',
] as const;

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

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function rootProductionFileNames(root: string) {
  return productionTypeScriptFiles(root)
    .filter((path) => dirname(path) === root)
    .map((path) => basename(path))
    .sort();
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

describe('Phase 8/9 auth architecture boundary', () => {
  it('keeps auth refactor target directories explicit for agent-readable responsibilities', () => {
    const expectedDirectories = [
      'access',
      'adapters',
      'application',
      'composition',
      'credentials',
      'domain',
      'errors',
      'login-attempts',
      'mappers',
      'operations',
      'registration',
      'security-events',
      'sessions',
      'verification',
    ];

    const missingDirectories = expectedDirectories.filter(
      (directory) => !existsSync(join(authRoot, directory)),
    );

    expect(missingDirectories).toEqual([]);
  });

  it('keeps removed top-level transition directories out of the final target', () => {
    const removedTransitionDirectories = ['queries', 'policies', 'repositories'];
    const existingTransitionDirectories = removedTransitionDirectories
      .filter((directory) => existsSync(join(authRoot, directory)))
      .map((directory) => `src/auth/${directory}`);

    expect(existingTransitionDirectories).toEqual([]);
  });

  it('keeps session lifecycle ownership in the sessions slice', () => {
    const expectedSessionSliceFiles = [
      'auth-session.repository.ts',
      'current-session.query.ts',
      'issue-session.command.ts',
      'logout-session.command.ts',
      'opaque-token.ts',
      'renew-session.command.ts',
      'revoke-sessions.command.ts',
      'session-lifecycle.policy.ts',
    ];
    const missingSessionSliceFiles = expectedSessionSliceFiles.filter(
      (file) => !existsSync(join(authRoot, 'sessions', file)),
    );
    const sessionService = readSource(join(authRoot, 'sessions/auth-session.service.ts'));

    expect(missingSessionSliceFiles).toEqual([]);
    expect(sessionService).not.toContain('PrismaService');
    expect(sessionService).not.toContain('createOpaqueToken');
    expect(sessionService).not.toContain('parseOpaqueToken');
    expect(sessionService).not.toContain('recordAuthSecurityEventSafely');
  });

  it('keeps session repository transaction-aware paths explicit', () => {
    const source = readSource(join(authRoot, 'sessions/auth-session.repository.ts'));

    expect(source).toContain('type AuthSessionClient =');
    expect(source).toContain('runSerializableTransaction<T>');
    expect(source).toContain('findRenewalSessionById(\n    client: AuthSessionClient');
    expect(source).toContain('rotateRenewalToken(\n    client: AuthSessionClient');
    expect(source).toContain('revokeSessionById(client: AuthSessionClient');
  });

  it('keeps verification, credentials, and registration ownership in their slices', () => {
    const expectedSliceFiles = {
      verification: [
        'auth-verification-lock.ts',
        'auth-verification-proof.ts',
        'auth-verification.service.ts',
        'auth-verification-eligibility.query.ts',
        'verification-code.repository.ts',
      ],
      credentials: [
        'password-hash.ts',
        'change-password.command.ts',
        'login.command.ts',
        'reset-password.command.ts',
      ],
      registration: ['auth-signup-validation.service.ts', 'signup.command.ts'],
    } as const;

    const missingSliceFiles = Object.entries(expectedSliceFiles).flatMap(([directory, files]) =>
      files
        .filter((file) => !existsSync(join(authRoot, directory, file)))
        .map((file) => `${directory}/${file}`),
    );

    expect(missingSliceFiles).toEqual([]);
    expect(existsSync(join(authRoot, 'domain/opaque-token.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'sessions/opaque-token.ts'))).toBe(true);
    expect(existsSync(join(authRoot, 'application/auth-password-hash.ts'))).toBe(true);
  });

  it('keeps login/reset/change/signup command behavior specs on their owning slices', () => {
    const requiredCommandSpecs = [
      'credentials/login.command.spec.ts',
      'credentials/reset-password.command.spec.ts',
      'credentials/change-password.command.spec.ts',
      'registration/signup.command.spec.ts',
    ];
    const missingCommandSpecs = requiredCommandSpecs.filter(
      (file) => !existsSync(join(authRoot, file)),
    );

    expect(missingCommandSpecs).toEqual([]);
  });

  it('keeps auth workflow orchestration in slice-local use-case providers', () => {
    const requiredUseCaseProviders = [
      'verification/auth-verification-use-cases.service.ts',
      'registration/auth-registration-use-cases.service.ts',
      'credentials/auth-credential-use-cases.service.ts',
      'sessions/auth-session-use-cases.service.ts',
    ];
    const missingUseCaseProviders = requiredUseCaseProviders.filter(
      (file) => !existsSync(join(authRoot, file)),
    );

    expect(missingUseCaseProviders).toEqual([]);
    expect(existsSync(join(authRoot, 'application/auth-use-cases.service.ts'))).toBe(false);
  });

  it('keeps login-attempt and security-event ownership in their slices', () => {
    const expectedSliceFiles = {
      'login-attempts': [
        'auth-login-attempt.service.ts',
        'clear-login-failures.command.ts',
        'get-active-login-lock.query.ts',
        'login-attempt.repository.ts',
        'login-lockout.policy.ts',
        'record-login-failure.command.ts',
      ],
      'security-events': [
        'auth-security-event.repository.ts',
        'auth-security-event.service.ts',
        'auth-security-event.types.ts',
        'security-alert.policy.ts',
        'security-event-sanitizer.ts',
      ],
    } as const;

    const missingSliceFiles = Object.entries(expectedSliceFiles).flatMap(([directory, files]) =>
      files
        .filter((file) => !existsSync(join(authRoot, directory, file)))
        .map((file) => `${directory}/${file}`),
    );

    expect(missingSliceFiles).toEqual([]);
    expect(existsSync(join(authRoot, 'repositories/security-event.repository.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'policies/security-event-sanitizer.ts'))).toBe(false);
    expect(existsSync(join(authRoot, 'policies/security-alert.policy.ts'))).toBe(false);
  });

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

  it('removes root compatibility wrappers after imports migrate to stable surfaces', () => {
    const remainingRemovedRootFiles = removedRootCompatibilityFiles
      .filter((file) => existsSync(join(authRoot, file)))
      .map((file) => `src/auth/${file}`);

    expect(remainingRemovedRootFiles).toEqual([]);
  });

  it('keeps auth free of season profile lifestyle parser ownership', () => {
    const removedAuthLifestylePaths = [
      join(authRoot, 'lifestyle.schema.ts'),
      join(authRoot, 'registration/lifestyle.schema.ts'),
    ];

    const existingAuthLifestylePaths = removedAuthLifestylePaths
      .filter((path) => existsSync(path))
      .map(relativeSourcePath);

    expect(existingAuthLifestylePaths).toEqual([]);
  });

  it('keeps login command out of the generic transition commands directory', () => {
    const genericCommandsDirectory = join(authRoot, 'commands');

    expect(existsSync(genericCommandsDirectory)).toBe(false);
    expect(existsSync(join(authRoot, 'credentials/login.command.ts'))).toBe(true);
  });

  it('keeps the final root production file target explicit with shrinking transition debt', () => {
    const allowedTransitionRootFiles = [...finalRootProductionFiles].sort();
    const rootFiles = rootProductionFileNames(authRoot);
    const unexpectedRootFiles = rootFiles.filter(
      (file) => !allowedTransitionRootFiles.includes(file),
    );
    const staleTransitionAllowlist = allowedTransitionRootFiles.filter(
      (file) => !rootFiles.includes(file),
    );

    expect(unexpectedRootFiles).toEqual([]);
    expect(staleTransitionAllowlist).toEqual([]);
  });

  it('keeps root-level specs limited to the final controller spec', () => {
    const allowedRootSpecFiles = ['auth.controller.spec.ts'];
    const rootSpecFiles = walkTypeScriptFiles(authRoot)
      .filter((path) => dirname(path) === authRoot && path.endsWith('.spec.ts'))
      .map((path) => basename(path))
      .sort();

    expect(rootSpecFiles).toEqual(allowedRootSpecFiles.sort());
  });

  it('keeps architecture and inventory guards on the architecture surface', () => {
    const architectureAuthRoot = join(apiSourceRoot, 'architecture/auth');

    expect(existsSync(join(architectureAuthRoot, 'auth-architecture-boundary.spec.ts'))).toBe(true);
    expect(existsSync(join(architectureAuthRoot, 'auth-route-metadata.inventory.spec.ts'))).toBe(
      true,
    );
    expect(
      existsSync(
        join(architectureAuthRoot, 'auth-domain-context-route-metadata.inventory.spec.ts'),
      ),
    ).toBe(true);
  });

  it('keeps AuthService final-facade migration debt explicit', () => {
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

  it('keeps external domains on the final public auth import surface or explicit transition surface', () => {
    const finalAllowedExternalAuthImports = [
      /(?:^|\/)auth\/auth\.module(?:\.js)?$/,
      /(?:^|\/)auth\/access\/[^'"]+(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-actor-context[^'"]*(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-password-hash(?:\.js)?$/,
    ];
    const transitionAllowedExternalAuthImports = [
      /(?:^|\/)auth\/operations\/auth-operational-cleanup\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/auth-operations-health\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/auth-operations\.module(?:\.js)?$/,
    ];
    const allowedExternalAuthImports = [
      ...finalAllowedExternalAuthImports,
      ...transitionAllowedExternalAuthImports,
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
  });

  it('keeps AuthModule provider composition grouped by auth slice', () => {
    const moduleSource = readSource(join(authRoot, 'auth.module.ts'));
    const providersSource = readSource(join(authRoot, 'composition/auth.providers.ts'));
    const exportsSource = readSource(join(authRoot, 'composition/auth.exports.ts'));

    expect(moduleSource).toContain("from './composition/auth.providers.js'");
    expect(moduleSource).toContain("from './composition/auth.exports.js'");
    expect(moduleSource).toContain('providers: AUTH_PROVIDERS');
    expect(moduleSource).toContain('exports: AUTH_EXPORTS');
    expect(moduleSource).not.toMatch(/providers:\s*\[\s*AuthService/);
    expect(moduleSource).not.toMatch(/exports:\s*\[\s*AuthService/);

    const expectedProviderGroups = [
      'AUTH_APPLICATION_PROVIDERS',
      'AUTH_VERIFICATION_PROVIDERS',
      'AUTH_SESSION_PROVIDERS',
      'AUTH_CREDENTIAL_PROVIDERS',
      'AUTH_REGISTRATION_PROVIDERS',
      'AUTH_LOGIN_ATTEMPT_PROVIDERS',
      'AUTH_SECURITY_EVENT_PROVIDERS',
      'AUTH_EMAIL_ADAPTER_PROVIDERS',
      'AUTH_ACCESS_PROVIDERS',
    ];

    for (const group of expectedProviderGroups) {
      expect(providersSource).toContain(`export const ${group}`);
      expect(providersSource).toContain(`...${group}`);
    }

    expect(providersSource).not.toContain('AuthUseCases');
    expect(providersSource.indexOf('useClass: ThrottlerGuard')).toBeLessThan(
      providersSource.indexOf('useClass: AuthenticatedUserGuard'),
    );
    expect(exportsSource).toContain('export const AUTH_EXPORTS');
    expect(exportsSource).toContain('AuthService');
    expect(exportsSource).toContain('AuthActorContextResolver');
    expect(exportsSource).toContain('AuthenticatedUserGuard');
    expect(exportsSource).not.toMatch(
      /\bAuthUseCases\b|\bAuthVerificationUseCases\b|\bAuthRegistrationUseCases\b|\bAuthCredentialUseCases\b|\bAuthSessionUseCases\b|\bAuthSessionService\b|\bAuthVerificationService\b|\bAuthLoginAttemptService\b|\bAuthSecurityEventService\b|\bAuthSessionRepository\b/,
    );
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

  it('keeps an AI-readable auth architecture note with public boundary rules', () => {
    const readmePath = join(authRoot, 'README.md');

    expect(existsSync(readmePath)).toBe(true);
    const source = readSource(readmePath);
    expect(source).toContain('Postgres authoritative');
    expect(source).toContain('RetentionWorkerPrismaService');
    expect(source).toContain('admin:operations:health:read');
    expect(source).toContain('composition/auth.providers.ts');
    expect(source).toContain('sessions/opaque-token.ts');
    expect(source).toContain('credentials/password-hash.ts');
    expect(source).toContain('auth-verification-use-cases.service.ts');
    expect(source).toContain('auth-registration-use-cases.service.ts');
    expect(source).toContain('auth-credential-use-cases.service.ts');
    expect(source).toContain('auth-session-use-cases.service.ts');
    expect(source).toContain('외부 domain production code');
  });
});
