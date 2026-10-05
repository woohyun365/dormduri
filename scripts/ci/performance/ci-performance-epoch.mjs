import { createHash } from 'node:crypto';

export const dependencyInputPaths = [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'infra/image-inventory.json',
];

function assertRecord(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
}

function assertString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${path} must be a non-empty string`);
  }
}

function assertSha(value, path, length) {
  if (typeof value !== 'string' || !new RegExp(`^[a-f0-9]{${length}}$`, 'u').test(value)) {
    throw new TypeError(`${path} must be a lowercase ${length}-character SHA`);
  }
}

export function parseMeasurementEpoch(input) {
  assertRecord(input, 'measurement epoch fixture');
  if (input.schemaVersion !== 1) {
    throw new TypeError('schemaVersion must equal 1');
  }
  assertRecord(input.epoch, 'epoch');
  const epoch = structuredClone(input.epoch);
  assertString(epoch.id, 'epoch.id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(epoch.id)) {
    throw new TypeError('epoch.id must be a lowercase kebab-case identifier');
  }
  if (!['collecting', 'closed'].includes(epoch.state)) {
    throw new TypeError('epoch.state must be collecting or closed');
  }
  assertString(epoch.capturedAt, 'epoch.capturedAt');
  if (!Number.isFinite(Date.parse(epoch.capturedAt))) {
    throw new TypeError('epoch.capturedAt must be an ISO timestamp');
  }
  assertSha(epoch.baseSha, 'epoch.baseSha', 40);
  assertRecord(epoch.fileSha256, 'epoch.fileSha256');
  for (const path of dependencyInputPaths) {
    assertSha(epoch.fileSha256[path], `epoch.fileSha256.${path}`, 64);
  }
  assertRecord(epoch.versions, 'epoch.versions');
  for (const [name, version] of Object.entries(epoch.versions)) {
    assertString(version, `epoch.versions.${name}`);
  }
  if (!Array.isArray(epoch.knownGaps)) {
    throw new TypeError('epoch.knownGaps must be an array');
  }
  epoch.knownGaps.forEach((gap, index) => assertString(gap, `epoch.knownGaps[${index}]`));
  return epoch;
}

export function buildDependencyFingerprint({ epoch, readText, sourceSha }) {
  assertRecord(epoch, 'epoch');
  if (typeof readText !== 'function') throw new TypeError('readText must be a function');
  assertSha(sourceSha, 'sourceSha', 40);
  const fileSha256 = Object.fromEntries(
    dependencyInputPaths.map((path) => {
      const content = readText(path);
      if (typeof content !== 'string') {
        throw new TypeError(`readText(${path}) must return a string`);
      }
      return [path, createHash('sha256').update(content).digest('hex')];
    }),
  );
  return { epochId: epoch.id, fileSha256, sourceSha };
}

export function compareDependencyFingerprint(epoch, fingerprint) {
  assertRecord(epoch, 'epoch');
  assertRecord(fingerprint, 'fingerprint');
  const changedInputs = dependencyInputPaths.filter(
    (path) => fingerprint.fileSha256?.[path] !== epoch.fileSha256?.[path],
  );
  if (fingerprint.epochId !== epoch.id) changedInputs.push('measurement-epoch');
  return {
    changedInputs: [...new Set(changedInputs)].sort(),
    comparisonBaseSha: epoch.baseSha,
    comparisonEpochId: epoch.id,
    state: changedInputs.length === 0 ? 'compatible-active-epoch' : 'changed-inputs',
  };
}
