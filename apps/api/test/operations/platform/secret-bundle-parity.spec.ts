import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// The user host has no Node, so the API deploy document installs and checks the runtime secret bundle with python3
// (infra/deploy/user/api/ssm/secret_bundle.py). The Node scripts stay as the rehearsal and fixture path. Both must give the
// same pass or fail judgment on the same fixtures; the contract file owns the rules (D-AB7).
const repoRoot = resolve(process.cwd(), '../..');
const contractPath = join(repoRoot, 'infra/deploy/api/secret-mount.contract.json');
const nodeVerify = join(repoRoot, 'infra/deploy/scripts/verify-api-secret-bundle.sh');
const pythonBundle = join(repoRoot, 'infra/deploy/user/api/ssm/secret_bundle.py');

interface Contract {
  readonly requiredFiles: string[];
  readonly maximumFileBytes: number;
}
const contract = JSON.parse(
  spawnSync('cat', [contractPath], { encoding: 'utf8' }).stdout,
) as Contract;
const root = mkdtempSync(join(tmpdir(), 'dormduri-secret-parity-'));
// Installed release directories are 0500, so give the owner write access back before removing the fixtures.
const writable = (directory: string): void => {
  chmodSync(directory, 0o700);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) writable(join(directory, entry.name));
  }
};
afterAll(() => {
  writable(root);
  rmSync(root, { recursive: true, force: true });
});

let fixtureCount = 0;
function bundle(change: (directory: string) => void = () => {}): string {
  fixtureCount += 1;
  const directory = join(root, `bundle-${fixtureCount}`);
  mkdirSync(directory, { mode: 0o700 });
  for (const name of contract.requiredFiles) {
    writeFileSync(join(directory, name), `fixture-${name}`, { mode: 0o400 });
  }
  change(directory);
  return directory;
}
const first = contract.requiredFiles[0] ?? '';
const replace = (directory: string, name: string, write: (path: string) => void) => {
  const path = join(directory, name);
  chmodSync(path, 0o600);
  unlinkSync(path);
  write(path);
};

const run = (command: string, args: string[], input?: string) =>
  spawnSync(command, args, { encoding: 'utf8', input });
const nodePasses = (directory: string) => run('sh', [nodeVerify, directory]).status === 0;
const pythonPasses = (directory: string) =>
  run('python3', ['-I', pythonBundle, 'verify', contractPath, directory]).status === 0;

const FIXTURES: ReadonlyArray<readonly [string, () => string, boolean]> = [
  ['valid 0400 bundle', () => bundle(), true],
  ['valid 0440 bundle', () => bundle((d) => chmodSync(join(d, first), 0o440)), true],
  ['missing key', () => bundle((d) => replace(d, first, () => {})), false],
  [
    'extra key',
    () => bundle((d) => writeFileSync(join(d, 'EXTRA_KEY'), 'x', { mode: 0o400 })),
    false,
  ],
  ['mode outside the contract', () => bundle((d) => chmodSync(join(d, first), 0o644)), false],
  [
    'symlink instead of a file',
    () =>
      bundle((d) =>
        replace(d, first, (path) => {
          writeFileSync(join(root, `target-${fixtureCount}`), 'linked-value', { mode: 0o400 });
          symlinkSync(join(root, `target-${fixtureCount}`), path);
        }),
      ),
    false,
  ],
  [
    'file larger than maximumFileBytes',
    () =>
      bundle((d) =>
        replace(d, first, (path) =>
          writeFileSync(path, 'x'.repeat(contract.maximumFileBytes + 1), { mode: 0o400 }),
        ),
      ),
    false,
  ],
  [
    'blank value',
    () => bundle((d) => replace(d, first, (path) => writeFileSync(path, ' \n', { mode: 0o400 }))),
    false,
  ],
];

describe('API secret bundle checks on the host (python3) and in rehearsal (Node)', () => {
  it.each(FIXTURES)('%s: both implementations give the same judgment', (_name, make, expected) => {
    const directory = make();
    expect({ node: nodePasses(directory), python: pythonPasses(directory) }).toEqual({
      node: expected,
      python: expected,
    });
  });

  const bundleJson = (change: (value: Record<string, unknown>) => void = () => {}) => {
    const value: Record<string, unknown> = Object.fromEntries(
      contract.requiredFiles.map((name) => [name, `json-${name}`]),
    );
    change(value);
    return JSON.stringify(value);
  };
  const install = (input: string, release: string) =>
    run(
      'python3',
      ['-I', pythonBundle, 'install', contractPath, join(root, 'releases'), release],
      input,
    );

  it('installs a JSON bundle as 0400 files in a 0500 release directory that the Node check accepts', () => {
    const result = install(bundleJson(), 'release-ok');
    const directory = join(root, 'releases', 'release-ok');

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain('json-');
    expect(readdirSync(directory).sort()).toEqual([...contract.requiredFiles].sort());
    expect((statSync(directory).mode & 0o777).toString(8)).toBe('500');
    for (const name of contract.requiredFiles) {
      expect((statSync(join(directory, name)).mode & 0o777).toString(8)).toBe('400');
    }
    expect(nodePasses(directory)).toBe(true);
  });

  it.each([
    ['a missing key', (value: Record<string, unknown>) => delete value[first]],
    ['an extra key', (value: Record<string, unknown>) => (value.EXTRA_KEY = 'x')],
    ['a non-string value', (value: Record<string, unknown>) => (value[first] = 7)],
    ['a blank value', (value: Record<string, unknown>) => (value[first] = '  ')],
    [
      'an oversized value',
      (value: Record<string, unknown>) =>
        (value[first] = 'x'.repeat(contract.maximumFileBytes + 1)),
    ],
  ])('refuses a JSON bundle with %s and leaves no release behind', (_name, change) => {
    const release = `release-bad-${fixtureCount++}`;
    const result = install(bundleJson(change), release);

    expect(result.status).toBe(65);
    expect(`${result.stdout}${result.stderr}`).not.toContain('json-');
    expect(readdirSync(join(root, 'releases'))).not.toContain(release);
    expect(
      readdirSync(join(root, 'releases')).filter((name) => name.startsWith('.incoming')),
    ).toEqual([]);
  });

  it('refuses a release id that already exists or could leave the releases directory', () => {
    expect(install(bundleJson(), 'release-ok').status).toBe(65);
    expect(install(bundleJson(), '../escape').status).toBe(65);
  });

  it('extracts only the expected single key of the migration bundle as a 0400 file', () => {
    const target = join(root, 'MIGRATION_DATABASE_URL');
    const ok = run(
      'python3',
      ['-I', pythonBundle, 'extract', contractPath, 'MIGRATION_DATABASE_URL', target],
      JSON.stringify({ MIGRATION_DATABASE_URL: 'postgresql://json-migration' }),
    );
    expect(ok.status).toBe(0);
    expect((statSync(target).mode & 0o777).toString(8)).toBe('400');
    const extra = run(
      'python3',
      ['-I', pythonBundle, 'extract', contractPath, 'MIGRATION_DATABASE_URL', join(root, 'other')],
      JSON.stringify({ MIGRATION_DATABASE_URL: 'postgresql://json-migration', DATABASE_URL: 'x' }),
    );
    expect(extra.status).toBe(65);
    expect(`${extra.stdout}${extra.stderr}`).not.toContain('json-migration');
  });
});
