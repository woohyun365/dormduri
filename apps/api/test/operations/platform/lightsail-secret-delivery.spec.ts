import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiDeploymentEnvManifest } from '../../../src/config/manifest/deployment-env-manifest.js';

const repoRoot = resolve(process.cwd(), '../..');
const deployRoot = join(repoRoot, 'infra/deploy');
const contractPath = join(deployRoot, 'api/secret-mount.contract.json');
const materializeScript = join(deployRoot, 'scripts/materialize-api-secret-bundle.sh');
const verifyScript = join(deployRoot, 'scripts/verify-api-secret-bundle.sh');
const installScript = join(deployRoot, 'scripts/install-api-secret-bundle.sh');
const entrypointPath = join(deployRoot, 'api/entrypoint.sh');

interface SecretMountContract {
  readonly requiredFiles: string[];
  readonly runtimeUid: number;
  readonly runtimeGid: number;
}

function readContract(): SecretMountContract {
  return JSON.parse(readFileSync(contractPath, 'utf8')) as SecretMountContract;
}

function writeSourceFixture(directory: string, suffix = 'v1'): string[] {
  const values: string[] = [];
  for (const name of readContract().requiredFiles) {
    const value = `private-fixture-${suffix}-${name}`;
    values.push(value);
    writeFileSync(join(directory, name), value, { mode: 0o600 });
  }
  return values;
}

describe('Lightsail secret delivery contract', () => {
  it('keeps policy terminology aligned with the deploy source matrix', () => {
    const policy = readFileSync(
      join(repoRoot, 'docs/policies/production-runtime-safety.md'),
      'utf8',
    );
    const checklist = readFileSync(
      join(repoRoot, 'infra/aws/secrets-manager-checklist.md'),
      'utf8',
    );

    for (const phrase of ['Secret origin', 'Release principal', 'Application read source']) {
      expect(checklist).toContain(phrase);
    }
    expect(policy).toContain('AWS production secret origin은 Secrets Manager');
    expect(policy).toContain('read-only `mounted-files`');
    expect(policy).toContain('OIDC 임시 role');
  });

  it('matches the production runtime secret inventory', () => {
    const manifest = createApiDeploymentEnvManifest();
    const expected = manifest.entries
      .filter((entry) => entry.scope === 'runtime' && entry.secret && entry.requiredInProduction)
      .map((entry) => entry.key)
      .sort();

    expect([...readContract().requiredFiles].sort()).toEqual(expected);
  });

  it('keeps long-lived AWS access key assignments out of committed release surfaces', () => {
    const files = spawnSync('git', ['ls-files', '.github', 'infra/deploy'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);
    const violations = files.filter((path) => {
      const content = readFileSync(join(repoRoot, path), 'utf8');
      return /(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*[^\s#]+/u.test(content);
    });

    expect(violations).toEqual([]);
  });

  it('keeps materialized bundles out of CI artifact upload paths', () => {
    const workflowFiles = spawnSync('git', ['ls-files', '.github/workflows'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);
    const violations = workflowFiles.filter((path) => {
      const content = readFileSync(join(repoRoot, path), 'utf8');
      return /upload-artifact[\s\S]{0,500}(?:secret-bundle|\/var\/lib\/dormduri\/secrets)/u.test(
        content,
      );
    });

    expect(violations).toEqual([]);
  });

  it('materializes, verifies, installs, activates, and rolls back without exposing values', () => {
    const root = mkdtempSync(join(tmpdir(), 'secret-delivery-'));
    const sourceV1 = join(root, 'source-v1');
    const sourceV2 = join(root, 'source-v2');
    const candidateV1 = join(root, 'candidate-v1');
    const candidateV2 = join(root, 'candidate-v2');
    const releases = join(root, 'host');
    mkdirSync(sourceV1);
    mkdirSync(sourceV2);
    const secretValues = [
      ...writeSourceFixture(sourceV1, 'v1'),
      ...writeSourceFixture(sourceV2, 'v2'),
    ];

    const commands: [string, ...string[]][] = [
      [materializeScript, sourceV1, candidateV1],
      [verifyScript, candidateV1],
      [installScript, 'install', candidateV1, releases, 'release-v1'],
      [installScript, 'activate', releases, 'release-v1'],
      [materializeScript, sourceV2, candidateV2],
      [installScript, 'install', candidateV2, releases, 'release-v2'],
      [installScript, 'activate', releases, 'release-v2'],
      [installScript, 'activate', releases, 'release-v1'],
    ];

    for (const [script, ...args] of commands) {
      const result = spawnSync(script, args, { encoding: 'utf8' });
      expect(result.status, `${script}: ${result.stderr}`).toBe(0);
      for (const value of secretValues) {
        expect(`${result.stdout}${result.stderr}`).not.toContain(value);
      }
    }

    expect(readlinkSync(join(releases, 'current'))).toBe('releases/release-v1');
  });

  it('preserves the current release when a candidate is partial or invalid', () => {
    const root = mkdtempSync(join(tmpdir(), 'secret-delivery-failure-'));
    const source = join(root, 'source');
    const candidate = join(root, 'candidate');
    const releases = join(root, 'host');
    mkdirSync(source);
    writeSourceFixture(source);
    expect(spawnSync(materializeScript, [source, candidate]).status).toBe(0);
    expect(spawnSync(installScript, ['install', candidate, releases, 'stable']).status).toBe(0);
    expect(spawnSync(installScript, ['activate', releases, 'stable']).status).toBe(0);

    const invalid = join(root, 'invalid');
    mkdirSync(invalid);
    const oneName = readContract().requiredFiles[0];
    expect(oneName).toBeDefined();
    writeFileSync(join(invalid, oneName!), 'partial', { mode: 0o644 });
    chmodSync(join(invalid, oneName!), 0o644);
    const failure = spawnSync(installScript, ['install', invalid, releases, 'broken'], {
      encoding: 'utf8',
    });

    expect(failure.status).not.toBe(0);
    expect(readlinkSync(join(releases, 'current'))).toBe('releases/stable');
  });

  it('boots the entrypoint from mounted files and fails closed for an absent mount', () => {
    const root = mkdtempSync(join(tmpdir(), 'entrypoint-mounted-secrets-'));
    writeSourceFixture(root);
    const manifest = createApiDeploymentEnvManifest();
    const secretKeys = new Set(readContract().requiredFiles);
    const publicRuntimeEnv = Object.fromEntries(
      manifest.projections.containerStartupRequired
        .filter((key) => !secretKeys.has(key))
        .map((key) => [key, 'public-runtime-value']),
    );
    const commonEnv = {
      ...process.env,
      ...publicRuntimeEnv,
      SECRET_SOURCE: 'mounted-files',
      API_ENV_MANIFEST_PATH: join(deployRoot, 'api/env.manifest.json'),
    };

    const success = spawnSync('sh', [entrypointPath, 'sh', '-c', 'exit 0'], {
      encoding: 'utf8',
      env: { ...commonEnv, SECRET_MOUNT_DIRECTORY: root },
    });
    const failure = spawnSync('sh', [entrypointPath, 'sh', '-c', 'exit 0'], {
      encoding: 'utf8',
      env: { ...commonEnv, SECRET_MOUNT_DIRECTORY: join(root, 'absent') },
    });

    expect(success.status, success.stderr).toBe(0);
    expect(failure.status).toBe(66);
    expect(failure.stderr).toBe('invalid API secret mount\n');
  });

  it('mounts the Lightsail secret pointer read-only without baking values into the image', () => {
    const compose = readFileSync(join(deployRoot, 'compose.api.yml'), 'utf8');
    const dockerfile = readFileSync(join(deployRoot, 'api/Dockerfile'), 'utf8');
    const contract = readContract();

    expect(compose).toContain('${API_SECRET_HOST_CURRENT:-api-secrets}');
    expect(compose).toContain('/run/secrets/dormduri-api:ro');
    expect(dockerfile).toContain(`groupadd --system --gid ${contract.runtimeGid} dormduri`);
    expect(dockerfile).toContain(`useradd --system --uid ${contract.runtimeUid}`);
    expect(dockerfile).not.toContain('secret-mount.contract.json');
    expect(dockerfile).not.toContain('private-fixture-');
  });

  it('keeps release readiness and evidence componentized and secret-free', () => {
    const componentPaths = [
      'infra/runbooks/release/components/api-secrets-manager/readiness.md',
      'infra/runbooks/release/components/api-secrets-manager/evidence.md',
      'infra/runbooks/release/components/lightsail-runtime/readiness.md',
      'infra/runbooks/release/components/lightsail-runtime/evidence.md',
    ];
    for (const path of componentPaths) {
      const content = readFileSync(join(repoRoot, path), 'utf8');
      expect(content).toContain('PENDING_TARGET');
      expect(content).not.toContain('postgresql://');
      expect(content).not.toMatch(/AWS_SECRET_ACCESS_KEY\s*=/u);
    }

    const aggregate = readFileSync(
      join(repoRoot, 'infra/runbooks/release/production-release-evidence.md'),
      'utf8',
    );
    expect(aggregate).toContain('components/api-secrets-manager/evidence.md');
    expect(aggregate).toContain('components/lightsail-runtime/evidence.md');
  });
});
