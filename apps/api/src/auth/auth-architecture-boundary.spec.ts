import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const authRoot = join(apiSourceRoot, 'auth');

const finalRootProductionFiles = ['auth.controller.ts', 'auth.module.ts'];

const transitionRootCompatibilityFiles = [
  'auth-access.decorator.ts',
  'auth-capability.ts',
  'auth-change-password-owner.ts',
  'auth-failures.ts',
  'auth-login-owner.ts',
  'auth-reset-password-owner.ts',
  'auth-response.builder.ts',
  'auth-security-alert.policy.ts',
  'auth-signup-owner.ts',
  'auth-user-view.ts',
  'auth-verification.store.ts',
  'auth.errors.ts',
  'auth.service.ts',
  'authenticated-user.decorator.ts',
  'authenticated-user.guard.ts',
  'email-sender.interface.ts',
  'monitored-email-sender.service.ts',
  'stub-email-sender.service.ts',
];

const transitionRootImplementationFiles = [
  'auth-login-attempt.service.ts',
  'auth-password.ts',
  'auth-request-context.ts',
  'auth-security-event.service.ts',
  'auth-security-event.types.ts',
  'auth-session.service.ts',
  'auth-signup-validation.service.ts',
  'auth-verification-lock.ts',
  'auth-verification-proof.ts',
  'auth-verification.service.ts',
  'auth.constants.ts',
  'auth.types.ts',
  'auth.utils.ts',
  'lifestyle.schema.ts',
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
      'commands',
      'controllers',
      'domain',
      'errors',
      'mappers',
      'operations',
      'policies',
      'queries',
      'repositories',
    ];

    const missingDirectories = expectedDirectories.filter(
      (directory) => !existsSync(join(authRoot, directory)),
    );

    expect(missingDirectories).toEqual([]);
  });

  it('keeps external production code away from auth internal implementation directories', () => {
    const forbiddenAuthInternalImports =
      /from\s+['"].*(?:\.\.\/)+auth\/(?:commands|repositories|domain|policies|adapters)(?:\/[^'"]*)?(?:\.js)?['"]/;

    const externalSourceRoots = readdirSync(apiSourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'auth' && entry.name !== 'generated')
      .map((entry) => join(apiSourceRoot, entry.name));

    const offenders = externalSourceRoots.flatMap((root) =>
      offendingFiles(root, forbiddenAuthInternalImports),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps root compatibility wrappers thin while imports migrate gradually', () => {
    const expectedWrappers: Record<string, string> = {
      'auth-access.decorator.ts': "export * from './access/auth-access.decorator.js';\n",
      'auth-capability.ts': "export * from './access/auth-capability.js';\n",
      'authenticated-user.decorator.ts':
        "export * from './access/authenticated-user.decorator.js';\n",
      'authenticated-user.guard.ts': "export * from './access/authenticated-user.guard.js';\n",
      'auth.controller.ts': "export * from './controllers/auth.controller.js';\n",
      'auth.service.ts': "export * from './application/auth.service.js';\n",
      'auth-signup-owner.ts': "export * from './commands/signup.command.js';\n",
      'auth-login-owner.ts': "export * from './commands/login.command.js';\n",
      'auth-reset-password-owner.ts': "export * from './commands/reset-password.command.js';\n",
      'auth-change-password-owner.ts': "export * from './commands/change-password.command.js';\n",
      'auth-verification.store.ts':
        "export * from './repositories/verification-code.repository.js';\n",
      'email-sender.interface.ts': "export * from './adapters/email/email-sender.interface.js';\n",
      'stub-email-sender.service.ts':
        "export * from './adapters/email/stub-email-sender.service.js';\n",
      'monitored-email-sender.service.ts':
        "export * from './adapters/email/monitored-email-sender.service.js';\n",
      'auth-security-alert.policy.ts': "export * from './policies/security-alert.policy.js';\n",
      'auth-response.builder.ts': "export * from './mappers/auth-response.builder.js';\n",
      'auth-user-view.ts': "export * from './mappers/auth-user-view.js';\n",
      'auth-failures.ts': "export * from './errors/auth-failures.js';\n",
      'auth.errors.ts': "export * from './errors/auth.errors.js';\n",
    };

    const mismatches = Object.entries(expectedWrappers).flatMap(([file, expectedSource]) => {
      const source = readSource(join(authRoot, file));
      return source === expectedSource ? [] : [file];
    });

    expect(mismatches).toEqual([]);
  });

  it('keeps the final root production file target explicit with shrinking transition debt', () => {
    const allowedTransitionRootFiles = [
      ...finalRootProductionFiles,
      ...transitionRootCompatibilityFiles,
      ...transitionRootImplementationFiles,
    ].sort();
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

  it('keeps AuthService final-facade migration debt explicit', () => {
    const source = readSource(join(authRoot, 'application/auth.service.ts'));
    const forbiddenFacadeResponsibilities = [
      ['PrismaService dependency', /\bPrismaService\b/],
      ['direct Prisma user lookup', /\bthis\.prisma\.user\.findUnique\b/],
      ['command Prisma dependency forwarding', /\bprisma:\s*this\.prisma\b/],
      ['session internals dependency', /\bAuthSessionService\b/],
      ['verification internals dependency', /\bAuthVerificationService\b/],
      ['login-attempt internals dependency', /\bAuthLoginAttemptService\b/],
      ['security-event write dependency', /\bAuthSecurityEventService\b/],
    ] as const;

    const offenders = forbiddenFacadeResponsibilities
      .filter(([, forbidden]) => forbidden.test(source))
      .map(([label]) => label);

    expect(offenders).toEqual([
      'PrismaService dependency',
      'direct Prisma user lookup',
      'command Prisma dependency forwarding',
      'session internals dependency',
      'verification internals dependency',
      'login-attempt internals dependency',
      'security-event write dependency',
    ]);
  });

  it('keeps external domains on the final public auth import surface or explicit transition surface', () => {
    const finalAllowedExternalAuthImports = [
      /(?:^|\/)auth\/auth\.module(?:\.js)?$/,
      /(?:^|\/)auth\/access\/[^'"]+(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-actor-context[^'"]*(?:\.js)?$/,
    ];
    const transitionAllowedExternalAuthImports = [
      /(?:^|\/)auth\/auth-access\.decorator(?:\.js)?$/,
      /(?:^|\/)auth\/auth-capability(?:\.js)?$/,
      /(?:^|\/)auth\/auth-password(?:\.js)?$/,
      /(?:^|\/)auth\/auth-session\.service(?:\.js)?$/,
      /(?:^|\/)auth\/auth\.utils(?:\.js)?$/,
      /(?:^|\/)auth\/authenticated-user\.decorator(?:\.js)?$/,
      /(?:^|\/)auth\/authenticated-user\.guard(?:\.js)?$/,
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

  it('keeps policy/domain helpers pure from Nest providers and Prisma clients', () => {
    const purePolicyOrDomainRoots = [
      'domain',
      'policies',
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

  it('keeps /health/auth as an ops-only protected capability route', () => {
    const healthController = readSource(join(apiSourceRoot, 'health/health.controller.ts'));
    const routeBlock =
      healthController.match(/@Get\('auth'\)[\s\S]*?getAuthOperations\(/)?.[0] ?? '';

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
    expect(source).toContain('외부 domain production code');
  });
});
