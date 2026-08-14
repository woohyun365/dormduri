#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const validScenarios = new Set(['smoke', 'baseline-250', 'peak-500']);
const productionOverrideValue = 'I_UNDERSTAND';
const scenario = process.argv[2];

if (!scenario || !validScenarios.has(scenario)) {
  console.error(
    `Usage: node test/stress/realtime/artillery/run-artillery-scenario.mjs <${[
      ...validScenarios,
    ].join('|')}>`,
  );
  process.exit(2);
}

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const scriptPath = resolve(apiRoot, `test/stress/realtime/artillery/${scenario}.yml`);
const summaryPath = resolve(
  apiRoot,
  process.env.STRESS_ARTILLERY_SUMMARY_PATH ||
    `test/stress/reports/.tmp-${scenario}-artillery-summary.json`,
);
const actorCsvPath = resolve(
  apiRoot,
  process.env.STRESS_ARTILLERY_ACTOR_CSV_PATH ||
    `test/stress/reports/.tmp-${scenario}-artillery-actors.csv`,
);
const parserPath = resolve(apiRoot, 'test/stress/evidence/parsers/parse-artillery-summary.ts');
let stressTarget;
let realtimeSmokeEnv = {};

if (!existsSync(scriptPath)) {
  console.error(`Artillery realtime scenario script does not exist: ${scriptPath}`);
  process.exit(2);
}

try {
  stressTarget = assertStressTargetAllowed(process.env);
  realtimeSmokeEnv = await prepareRealtimeSmokeEnvironment({
    artifactPath: process.env.STRESS_ACTOR_TOKENS_PATH
      ? resolve(apiRoot, process.env.STRESS_ACTOR_TOKENS_PATH)
      : '',
    csvPath: actorCsvPath,
    targetUrl: stressTarget.targetUrl,
    scenarioName: scenario,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const artilleryVersion = spawnSync('artillery', ['version'], { encoding: 'utf8' });
if (artilleryVersion.error?.code === 'ENOENT') {
  console.error(
    'Artillery CLI is required for realtime stress runs. Install it on a local/CI/runner machine with: npm install -g artillery@latest',
  );
  process.exit(127);
}

mkdirSync(dirname(summaryPath), { recursive: true });

const artilleryRun = spawnSync('artillery', ['run', '--output', summaryPath, scriptPath], {
  cwd: dirname(scriptPath),
  stdio: 'inherit',
  env: {
    ...process.env,
    ...realtimeSmokeEnv,
    STRESS_REALTIME_ORIGIN: process.env.STRESS_REALTIME_ORIGIN || stressTarget.origin,
    STRESS_REALTIME_SOCKET_URL:
      process.env.STRESS_REALTIME_SOCKET_URL || resolveRealtimeSocketUrl(stressTarget.targetUrl),
  },
});
const artilleryExitCode = typeof artilleryRun.status === 'number' ? artilleryRun.status : 1;

if (!existsSync(summaryPath)) {
  process.exit(artilleryExitCode);
}

const tsNodeRegister =
  'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));';
const parserRun = spawnSync(
  process.execPath,
  [
    '--no-deprecation',
    '--import',
    tsNodeRegister,
    parserPath,
    summaryPath,
    '--scenario',
    scenario,
    '--artillery-exit-code',
    String(artilleryExitCode),
  ],
  {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  },
);

if (typeof parserRun.status === 'number') {
  process.exit(parserRun.status);
}

console.error(`Failed to parse Artillery summary via ${pathToFileURL(parserPath).href}`);
process.exit(1);

async function prepareRealtimeSmokeEnvironment({ artifactPath, csvPath, targetUrl, scenarioName }) {
  if (scenarioName !== 'smoke') {
    throw new Error(
      'Only the smoke realtime scenario is executable by this runner. baseline-250/peak-500 need a separate approved runner because chat realtime tickets are one-time handshake credentials and Artillery opens sockets before per-row payload values can be applied to auth.',
    );
  }

  if (!artifactPath || !existsSync(artifactPath)) {
    throw new Error(
      'STRESS_ACTOR_TOKENS_PATH must point to an existing local/staging token artifact before realtime stress runs.',
    );
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const actors = Array.isArray(artifact.actors) ? artifact.actors : [];
  const chatActors = actors.filter(
    (actor) =>
      isNonEmptyString(actor.actorId) &&
      isNonEmptyString(actor.userId) &&
      isNonEmptyString(actor.participantId) &&
      isNonEmptyString(actor.targetUserId) &&
      isNonEmptyString(actor.threadId) &&
      isNonEmptyString(actor.accessToken),
  );

  if (chatActors.length === 0) {
    throw new Error(
      'STRESS_ACTOR_TOKENS_PATH did not contain any actor rows with threadId for realtime stress.',
    );
  }

  mkdirSync(dirname(csvPath), { recursive: true });
  const actor = chatActors[0];
  const realtimeTicket = await issueRealtimeTicket({
    actor,
    targetUrl,
  });
  writeFileSync(
    csvPath,
    [
      'actorId,userId,participantId,targetUserId,threadId',
      [actor.actorId, actor.userId, actor.participantId, actor.targetUserId, actor.threadId]
        .map(csvEscape)
        .join(','),
    ].join('\n') + '\n',
    { mode: 0o600 },
  );

  return {
    STRESS_ARTILLERY_ACTOR_CSV_PATH: relative(dirname(scriptPath), csvPath),
    STRESS_REALTIME_TICKET: realtimeTicket,
    STRESS_REALTIME_THREAD_ID: actor.threadId,
  };
}

async function issueRealtimeTicket({ actor, targetUrl }) {
  const response = await fetch(`${targetUrl.href.replace(/\/$/u, '')}/api/chat/realtime/tickets`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${actor.accessToken}`,
      'User-Agent': 'knu-roommate-artillery-realtime-stress-preflight',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Realtime ticket preflight failed with HTTP ${response.status}. Wait for local/staging rate-limit windows to reset before rerunning realtime smoke.`,
    );
  }

  const body = await response.json();
  if (!body || typeof body.ticket !== 'string' || !body.ticket) {
    throw new Error('Realtime ticket preflight response did not contain ticket.');
  }

  return body.ticket;
}

function assertStressTargetAllowed(env) {
  if (!env.STRESS_TARGET_URL?.trim()) {
    throw new Error('STRESS_TARGET_URL is required before realtime stress runs.');
  }

  let url;
  try {
    url = new URL(env.STRESS_TARGET_URL);
  } catch {
    throw new Error(`STRESS_TARGET_URL is not a valid URL: ${env.STRESS_TARGET_URL}`);
  }

  if (url.username || url.password) {
    throw new Error('STRESS_TARGET_URL must not embed credentials.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Stress target protocol ${url.protocol} is not allowed. Use http or https.`);
  }

  const hostname = url.hostname.toLowerCase();
  const allowedHosts = parseAllowedHosts(env.STRESS_ALLOWED_HOSTS);
  const safeTarget =
    isLocalHostname(hostname) || isPrivateIpv4(hostname) || allowedHosts.includes(hostname);
  const productionLike =
    !safeTarget || env.NODE_ENV === 'production' || ['production', 'prod'].includes(env.STRESS_ENV);

  if (productionLike && env.STRESS_ALLOW_PRODUCTION !== productionOverrideValue) {
    throw new Error(
      `Realtime stress target ${hostname} is production-like or not allowlisted. Set STRESS_ALLOWED_HOSTS for staging/private targets or STRESS_ALLOW_PRODUCTION=${productionOverrideValue} for an approved run.`,
    );
  }

  return {
    targetUrl: url,
    origin: url.origin,
  };
}

function resolveRealtimeSocketUrl(targetUrl) {
  const socketUrl = new URL(targetUrl.href);
  socketUrl.pathname = `${socketUrl.pathname.replace(/\/$/u, '')}/chat`;
  socketUrl.search = '';
  socketUrl.hash = '';
  return socketUrl.href;
}

function parseAllowedHosts(input) {
  return String(input || '')
    .split(/[\s,]+/u)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'host.docker.internal' ||
    hostname.endsWith('.localhost')
  );
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function csvEscape(value) {
  const raw = String(value ?? '');
  return /[",\n]/u.test(raw) ? `"${raw.replace(/"/gu, '""')}"` : raw;
}
