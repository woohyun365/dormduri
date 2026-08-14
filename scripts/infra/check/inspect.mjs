#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const enforcedClassifications = new Set(['production-candidate', 'runtime-base']);

const rules = [
  {
    id: 'mutable-image',
    applies: ({ classification }) => enforcedClassifications.has(classification),
    matches: (line) => /^\s*image:\s*.*:latest(?:\}|['"])?\s*$/u.test(line),
    message: 'mutable image reference',
  },
  {
    id: 'stress-policy-in-production',
    applies: ({ classification }) => classification === 'production-candidate',
    matches: (line) =>
      /\bSTRESS_[A-Z0-9_]+\b/u.test(line) ||
      /\b(?:AUTH_THROTTLE_LIMIT|AUTH_LOGIN_(?:BURST|SUSTAINED)_LIMIT)\b[^\n]*(?:5000|STRESS_)/u.test(
        line,
      ),
    message: 'stress-only policy in production candidate',
  },
  {
    id: 'local-placeholder',
    applies: ({ classification }) => enforcedClassifications.has(classification),
    matches: (line) =>
      /(?:REPLACE_ME|change-me-local-only|host\.docker\.internal|@localhost(?::|\/)|127\.0\.0\.1:5432|:-\.\/\.env)/u.test(
        line,
      ),
    message: 'local or placeholder runtime value',
  },
  {
    id: 'example-secret-mount',
    applies: ({ classification }) => enforcedClassifications.has(classification),
    matches: (line) => /(?:secret|token)[^\n]*\.example/u.test(line),
    message: 'example secret file mounted by runtime base',
  },
  {
    id: 'public-observability-port',
    applies: ({ classification }) => classification === 'runtime-base',
    matches: (line) => /^\s*-\s*(?:['"])?(?:0\.0\.0\.0:|\$\{[^}]+:-0\.0\.0\.0\})/u.test(line),
    message: 'observability port binds to every interface',
  },
];

export function inspectSources(sources) {
  const findings = [];
  const topology = [];
  for (const source of sources) {
    const lines = source.source.split(/\r?\n/u);
    lines.forEach((line, index) => {
      for (const rule of rules) {
        if (rule.applies(source) && rule.matches(line)) {
          findings.push({
            ruleId: rule.id,
            path: source.path,
            line: index + 1,
            category: rule.message,
          });
        }
      }
      const port = parsePortBinding(line);
      if (port) topology.push({ path: source.path, line: index + 1, ...port });
    });
  }
  return { findings, topology };
}

export function redactInspectionReport(report) {
  return JSON.parse(JSON.stringify(report));
}

export function inspectRepository(root = repoRoot) {
  const inventory = JSON.parse(readFileSync(resolve(root, 'infra/compose-profiles.json'), 'utf8'));
  const sourceByPath = new Map();
  for (const profile of Object.values(inventory.profiles)) {
    for (const path of profile.files) {
      if (!sourceByPath.has(path)) {
        sourceByPath.set(path, {
          path,
          classification: profile.classification,
          source: readFileSync(resolve(root, path), 'utf8'),
        });
      }
    }
  }
  const report = inspectSources([...sourceByPath.values()]);
  return {
    version: 1,
    mode: 'non-blocking-inventory',
    generatedAt: new Date().toISOString(),
    profiles: Object.entries(inventory.profiles).map(([name, profile]) => ({
      name,
      classification: profile.classification,
      files: profile.files,
    })),
    ...report,
    envDrift: inspectApiEnvDrift(root),
  };
}

function inspectApiEnvDrift(root) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'infra/deploy/api/env.manifest.json'), 'utf8'),
  );
  const registryKeys = new Set(manifest.entries.map((entry) => entry.key));
  const runtimeKeys = new Set(
    manifest.entries.filter((entry) => entry.scope === 'runtime').map((entry) => entry.key),
  );
  const migrationKeys = new Set(
    manifest.entries.filter((entry) => entry.scope === 'migration').map((entry) => entry.key),
  );
  const runtimeRequired = new Set(manifest.projections.containerStartupRequired);
  const migrationRequired = new Set(manifest.projections.migrationRequired);
  const runtimeExampleKeys = parseEnvKeys(
    readFileSync(resolve(root, 'infra/deploy/.env.api.example'), 'utf8'),
  );
  const migrationExampleKeys = parseEnvKeys(
    readFileSync(resolve(root, 'infra/deploy/.env.api.migration.example'), 'utf8'),
  );
  return {
    registryKeyCount: registryKeys.size,
    runtimeKeyCount: runtimeKeys.size,
    migrationKeyCount: migrationKeys.size,
    runtimeExampleKeyCount: runtimeExampleKeys.size,
    migrationExampleKeyCount: migrationExampleKeys.size,
    optionalRuntimeKeysOmitted: sortedDifference(runtimeKeys, runtimeExampleKeys),
    runtimeRequiredMissingFromExample: sortedDifference(runtimeRequired, runtimeExampleKeys),
    migrationRequiredMissingFromExample: sortedDifference(migrationRequired, migrationExampleKeys),
    runtimeExampleOutsideManifest: sortedDifference(runtimeExampleKeys, runtimeKeys),
    migrationExampleOutsideManifest: sortedDifference(migrationExampleKeys, migrationKeys),
  };
}

function parseEnvKeys(source) {
  return new Set(
    source
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/u)?.[1])
      .filter(Boolean),
  );
}

function sortedDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function parsePortBinding(line) {
  const match = line.match(/^\s*-\s*['"]?([^\s'"]+):(\d+)(?::\d+)?['"]?\s*$/u);
  if (!match) return null;
  const host = match[1];
  return { exposure: host.includes('127.0.0.1') ? 'loopback' : 'configured', binding: host };
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const report = redactInspectionReport(inspectRepository());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
