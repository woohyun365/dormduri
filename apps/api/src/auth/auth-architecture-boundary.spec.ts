import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
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

describe('Phase 8 auth architecture boundary', () => {
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
