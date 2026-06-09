import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const usersRoot = join(apiSourceRoot, 'users');
const lifecycleRoot = join(apiSourceRoot, 'lifecycle');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');

const finalRootRuntimeFiles = ['users.controller.ts', 'users.module.ts'] as const;

const finalRootSpecFiles = ['users.controller.spec.ts'] as const;

const requiredFinalDirectories = [
  'account-deletion',
  'application',
  'composition',
  'contracts',
  'current-user',
  'errors',
  'identity',
  'onboarding',
  'operations',
  'retention',
] as const;

const requiredIdentitySubdirectories = ['academic', 'audit', 'display'] as const;

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

function specTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function rootRelativePath(path: string, root: string) {
  return relative(root, path).split(sep).join('/');
}

function filesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

function expectReadmeSections(path: string, sections: readonly string[]) {
  expect(existsSync(path)).toBe(true);
  const source = readSource(path);

  for (const section of sections) {
    expect(source).toContain(section);
  }

  return source;
}

describe('users final structure boundary', () => {
  it('documents users as the account self-service boundary source of truth', () => {
    const source = expectReadmeSections(join(usersRoot, 'README.md'), [
      '## Public boundary',
      '## Directory responsibilities',
      '## Hard rules',
      '## Architecture guard',
      '## Where to change users behavior',
      '## Policy references',
      '## Useful verification',
    ]);

    expect(source).toContain('account self-service API');
    expect(source).toContain('Top-level `identity/` remains pure shared-kernel code');
    expect(source).toContain(
      'Campus service-state resolution is seasons/runtime domain context vocabulary',
    );
  });

  it('keeps root production files on the documented public surface', () => {
    const rootRuntimeFiles = productionTypeScriptFiles(usersRoot)
      .filter((path) => dirname(path) === usersRoot)
      .map((path) => rootRelativePath(path, usersRoot))
      .sort();

    expect(rootRuntimeFiles).toEqual([...finalRootRuntimeFiles].sort());
  });

  it('keeps only route behavior regression spec on the users root spec surface', () => {
    const rootSpecFiles = specTypeScriptFiles(usersRoot)
      .filter((path) => dirname(path) === usersRoot)
      .map((path) => rootRelativePath(path, usersRoot))
      .sort();

    expect(rootSpecFiles).toEqual([...finalRootSpecFiles].sort());
  });

  it('keeps users responsibilities in final product directories', () => {
    for (const directory of requiredFinalDirectories) {
      expect(existsSync(join(usersRoot, directory))).toBe(true);
    }

    for (const directory of requiredIdentitySubdirectories) {
      expect(existsSync(join(usersRoot, 'identity', directory))).toBe(true);
    }
  });

  it('moves campus service-state ownership out of users', () => {
    const usersServiceStatePath = join(usersRoot, 'service-state.ts');
    const forbiddenUsersServiceStateImport = /from\s+['"][^'"]*users\/service-state(?:\.js)?['"]/;
    const serviceStateImportOffenders = productionTypeScriptFiles(apiSourceRoot)
      .filter((path) => path !== usersServiceStatePath)
      .filter((path) => forbiddenUsersServiceStateImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(existsSync(usersServiceStatePath)).toBe(false);
    expect(serviceStateImportOffenders).toEqual([]);
  });

  it('keeps season-participants away from users route error internals', () => {
    const forbiddenUsersErrorImport =
      /from\s+['"][^'"]*users\/(?:users\.errors|errors\/[^'"]+)(?:\.js)?['"]/;

    expect(filesContaining(seasonParticipantsRoot, forbiddenUsersErrorImport)).toEqual([]);
  });

  it('keeps lifecycle sweep on a narrow users retention port', () => {
    const adapterPath = join(lifecycleRoot, 'adapters', 'lifecycle-sweep-tasks.adapter.ts');
    const source = readSource(adapterPath);

    expect(source).toContain('USER_RETENTION_SWEEP_PORT');
    expect(source).not.toMatch(/UsersService|users\.service/);
  });

  it('keeps UsersModule provider and export arrays as composition source of truth', () => {
    const moduleSource = readSource(join(usersRoot, 'users.module.ts'));

    expect(moduleSource).toContain("from './composition/users.providers.js'");
    expect(moduleSource).toContain("from './composition/users.exports.js'");
    expect(moduleSource).toContain('providers: USERS_PROVIDERS');
    expect(moduleSource).toContain('exports: USERS_EXPORTS');
    expect(moduleSource).not.toMatch(/providers:\s*\[/);
    expect(moduleSource).not.toMatch(/exports:\s*\[/);
  });
});
