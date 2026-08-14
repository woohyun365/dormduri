import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const lifecycleRoot = join(apiSourceRoot, 'lifecycle');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');
const authRoot = join(apiSourceRoot, 'auth');
const usersRoot = join(apiSourceRoot, 'users');

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

function filesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

describe('users product architecture boundary', () => {
  it('keeps season-participants away from users route error internals', () => {
    const forbiddenUsersErrorImport =
      /from\s+['"][^'"]*users\/(?:users\.errors|errors\/[^'"]+)(?:\.js)?['"]/;

    expect(filesContaining(seasonParticipantsRoot, forbiddenUsersErrorImport)).toEqual([]);
  });

  it('keeps lifecycle retention sweep outside the users public port surface', () => {
    const adapterPath = join(lifecycleRoot, 'adapters', 'lifecycle-sweep-tasks.adapter.ts');
    const source = readSource(adapterPath);
    const removedUsersRetentionSweepPortName = ['USER', 'RETENTION', 'SWEEP', 'PORT'].join('_');

    expect(source).toContain('RETENTION_SWEEP_PORT');
    expect(source).not.toContain(removedUsersRetentionSweepPortName);
    expect(source).not.toMatch(/UsersService|users\.service/);
  });

  it('keeps signup and user nickname mutations on one display identity policy owner', () => {
    const authModuleSource = readSource(join(authRoot, 'auth.module.ts'));
    const usersModuleSource = readSource(join(usersRoot, 'users.module.ts'));
    const policySource = readSource(
      join(usersRoot, 'identity/display/display-identity-nickname-policy.service.ts'),
    );
    const authRegistrationFiles = productionTypeScriptFiles(join(authRoot, 'registration'));
    const usersMutationFiles = [
      ...productionTypeScriptFiles(join(usersRoot, 'application')),
      ...productionTypeScriptFiles(join(usersRoot, 'operations')),
      ...productionTypeScriptFiles(join(usersRoot, 'identity/display')),
    ].filter((path) => !path.endsWith('display-identity-nickname-policy.service.ts'));
    const independentPolicyComposition = /ModerationService|parseDisplayIdentityNickname\s*}/;

    expect(authModuleSource).toContain('DisplayIdentityModule');
    expect(usersModuleSource).toContain('DisplayIdentityModule');
    expect(authModuleSource).not.toContain('UsersModule');
    expect(authModuleSource).not.toContain('forwardRef(');
    expect(usersModuleSource).not.toContain('forwardRef(');
    expect(policySource).toContain('ModerationService');
    expect(
      [...authRegistrationFiles, ...usersMutationFiles]
        .filter((path) => independentPolicyComposition.test(readSource(path)))
        .map(relativeSourcePath)
        .sort(),
    ).toEqual([]);
  });
});
