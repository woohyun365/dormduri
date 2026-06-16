#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '../../..');
const repoRoot = resolve(apiRoot, '../..');
const productionLikeRunner = resolve(scriptDir, 'run-production-like-evidence.mjs');
const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
const reportPath = resolve(
  repoRoot,
  process.env.STRESS_237_RAMP_REPORT_PATH ||
    `.omx/reports/api-237-ramp-decision-result-${timestamp}.md`,
);
const defaultStages = [
  { id: 'vu25', label: 'Step A warm baseline', vus: 25, duration: '2m' },
  { id: 'vu50', label: 'Step B medium ramp', vus: 50, duration: '3m' },
  { id: 'vu100', label: 'Step C high ramp', vus: 100, duration: '5m' },
  { id: 'vu237', label: 'Step D full 237 VU ramp', vus: 237, duration: '5m' },
];
const stages = selectStages(defaultStages);
const planOnly = process.env.STRESS_237_RAMP_PLAN_ONLY === 'true';
const enableWriteMix = process.env.STRESS_237_RAMP_ENABLE_WRITE_MIX === 'true';
const enableRealtimeSmoke = process.env.STRESS_237_RAMP_ENABLE_REALTIME_SMOKE === 'true';
const continueOnFail = process.env.STRESS_237_RAMP_CONTINUE_ON_FAIL === 'true';
const stageResults = [];
let stoppedReason = '';

if (stages.length === 0) {
  console.error('No 237 ramp stages selected. Use STRESS_237_RAMP_STAGES=25,50,100,237.');
  process.exit(2);
}

for (const [index, stage] of stages.entries()) {
  const stageReportPath = resolve(
    repoRoot,
    `.omx/reports/api-237-ramp-decision-${stage.id}-${timestamp}.md`,
  );
  const stageEnv = buildStageEnv({ stage, index, stageReportPath });

  if (planOnly) {
    stageResults.push({
      ...stage,
      status: 'planned',
      exitCode: null,
      reportPath: stageReportPath,
      baseline: null,
      score: null,
      decision: 'plan-only',
      stopReason: '',
    });
    continue;
  }

  const run = spawnSync(process.execPath, [productionLikeRunner], {
    cwd: repoRoot,
    env: stageEnv,
    stdio: 'inherit',
  });
  const exitCode = typeof run.status === 'number' ? run.status : 1;
  const parsedReport = existsSync(stageReportPath) ? parseStageReport(stageReportPath) : null;
  const gate = evaluateStageGate({
    exitCode,
    baseline: parsedReport?.baseline,
    score: parsedReport?.score,
  });

  stageResults.push({
    ...stage,
    status: exitCode === 0 ? 'completed' : 'failed',
    exitCode,
    reportPath: stageReportPath,
    baseline: parsedReport?.baseline ?? null,
    score: parsedReport?.score ?? null,
    decision: gate.decision,
    stopReason: gate.stopReason,
  });

  if (gate.stopReason) {
    stoppedReason = `${stage.id}: ${gate.stopReason}`;
    if (!continueOnFail) {
      break;
    }
  }
}

writeDecisionReport();
console.log(`237 ramp decision report: ${reportPath}`);

const failedStage = stageResults.find((stage) => stage.exitCode && stage.exitCode !== 0);
process.exit(failedStage ? 1 : 0);

function buildStageEnv({ stage, index, stageReportPath }) {
  const duration =
    process.env[`STRESS_237_RAMP_${stage.id.toUpperCase()}_DURATION`] ||
    process.env.STRESS_237_RAMP_STAGE_DURATION ||
    stage.duration;
  const skipBuild = index > 0 ? 'true' : process.env.STRESS_DOCKER_SKIP_BUILD || 'false';

  return {
    ...process.env,
    STRESS_DOCKER_PROFILE: 'production-like',
    STRESS_DOCKER_REPORT_PATH: relative(repoRoot, stageReportPath),
    STRESS_DOCKER_RUN_ID: `237-ramp-${stage.id}-${timestamp}`,
    STRESS_DOCKER_OBSERVABILITY: process.env.STRESS_DOCKER_OBSERVABILITY || 'true',
    STRESS_DOCKER_KEEP_UP: process.env.STRESS_DOCKER_KEEP_UP || 'true',
    STRESS_DOCKER_SKIP_BUILD: skipBuild,
    STRESS_DOCKER_SKIP_WRITE_MIX: enableWriteMix ? 'false' : 'true',
    STRESS_DOCKER_SKIP_REALTIME_SMOKE: enableRealtimeSmoke ? 'false' : 'true',
    STRESS_DOCKER_CONTINUE_ON_STRESS_FAILURE: 'true',
    STRESS_COHORT_SIZE: '237',
    STRESS_LARGEST_COHORT_SIZE: '237',
    STRESS_TOKEN_ACTOR_LIMIT: process.env.STRESS_TOKEN_ACTOR_LIMIT || '50',
    STRESS_FIXTURE_PREFIX: `api-237-ramp-stress-${stage.id}`,
    STRESS_SEASON_ID: `api-237-ramp-stress-season-${stage.id}`,
    STRESS_BASELINE_VUS: String(stage.vus),
    STRESS_SCORE_COHORT_VUS: String(stage.vus),
    STRESS_BASELINE_DURATION: duration,
    STRESS_SCORE_COHORT_DURATION: duration,
    STRESS_WRITE_MIX_VUS: process.env.STRESS_WRITE_MIX_VUS || '10',
    STRESS_WRITE_MIX_DURATION: process.env.STRESS_WRITE_MIX_DURATION || '30s',
  };
}

function selectStages(inputStages) {
  const rawSelection = process.env.STRESS_237_RAMP_STAGES;
  if (!rawSelection?.trim()) {
    return inputStages;
  }

  const selected = new Set(
    rawSelection
      .split(/[,\s]+/u)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => (value.startsWith('vu') ? value : `vu${value}`)),
  );

  return inputStages.filter((stage) => selected.has(stage.id));
}

function parseStageReport(path) {
  const text = readFileSync(path, 'utf8');
  return {
    baseline: parseK6ReportRow(text, 'baseline-250'),
    score: parseK6ReportRow(text, 'score-cohort-946'),
  };
}

function parseK6ReportRow(text, scenarioName) {
  const line = text
    .split('\n')
    .find((candidate) => candidate.trim().startsWith(`| ${scenarioName} |`));
  if (!line) {
    return null;
  }

  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  const [, durationMs, p95, p99, failedRate, checksRate] = cells;

  return {
    durationMs: parseOptionalNumber(durationMs),
    p95: parseOptionalNumber(p95),
    p99: parseOptionalNumber(p99),
    failedRate: parseOptionalNumber(failedRate),
    checksRate: parseOptionalNumber(checksRate),
  };
}

function parseOptionalNumber(value) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateStageGate({ exitCode, baseline, score }) {
  if (exitCode !== 0) {
    return {
      decision: 'stop-runner-failed',
      stopReason: `stage runner failed with exit ${exitCode}`,
    };
  }

  const scoreP95 = score?.p95;
  const scoreP99 = score?.p99;
  const scoreFailedRate = score?.failedRate;
  const scoreChecksRate = score?.checksRate;
  const baselineP95 = baseline?.p95;
  const baselineFailedRate = baseline?.failedRate;
  const baselineChecksRate = baseline?.checksRate;

  if ((scoreFailedRate ?? 0) > 0.01 || (baselineFailedRate ?? 0) > 0.01) {
    return {
      decision: 'stop-error-rate',
      stopReason: 'http_req_failed rate exceeded 1%',
    };
  }
  if (
    (scoreChecksRate !== null && scoreChecksRate !== undefined && scoreChecksRate < 0.98) ||
    (baselineChecksRate !== null && baselineChecksRate !== undefined && baselineChecksRate < 0.98)
  ) {
    return {
      decision: 'stop-check-rate',
      stopReason: 'checks rate dropped below 98%',
    };
  }
  if ((scoreP95 ?? 0) >= 500 || (baselineP95 ?? 0) >= 500) {
    return {
      decision: 'stop-latency-gate',
      stopReason: 'p95 reached 500ms stop gate',
    };
  }
  if ((scoreP95 ?? 0) >= 300 || (scoreP99 ?? 0) >= 1500) {
    return {
      decision: 'cache-escalation-candidate',
      stopReason: '',
    };
  }
  if (
    scoreP95 !== null &&
    scoreP95 !== undefined &&
    scoreP99 !== null &&
    scoreP99 !== undefined &&
    scoreP95 < 300 &&
    scoreP99 < 1000
  ) {
    return {
      decision: 'cache-defer-candidate',
      stopReason: '',
    };
  }

  return {
    decision: 'needs-manual-review',
    stopReason: '',
  };
}

function writeDecisionReport() {
  mkdirSync(dirname(reportPath), { recursive: true });
  const completedStages = stageResults.filter((stage) => stage.status === 'completed');
  const cacheEscalationStages = completedStages.filter(
    (stage) => stage.decision === 'cache-escalation-candidate',
  );
  const cacheDecision = decideCacheOutcome({ completedStages, cacheEscalationStages });
  const report = [
    '# API 237 cohort ramp decision result',
    '',
    `- generatedAt: ${new Date().toISOString()}`,
    `- gitCommit: ${captureGit('rev-parse', ['HEAD'])}`,
    `- gitBranch: ${captureGit('branch', ['--show-current'])}`,
    `- mode: ${planOnly ? 'plan-only' : 'execution'}`,
    '- targetClass: local docker nginx/API/PostgreSQL with optional observability',
    '- fixtureCohortSize: 237',
    '- fixtureLargestCohortSize: 237',
    `- tokenActorLimit: ${process.env.STRESS_TOKEN_ACTOR_LIMIT || '50'}`,
    `- observabilityEnabled: ${process.env.STRESS_DOCKER_OBSERVABILITY || 'true'}`,
    `- writeMixEnabled: ${enableWriteMix ? 'true' : 'false'}`,
    `- realtimeSmokeEnabled: ${enableRealtimeSmoke ? 'true' : 'false'}`,
    `- stoppedReason: ${stoppedReason || 'none'}`,
    '',
    '## Stage results',
    '',
    '| Stage | VU | Duration | Status | Exit | baseline p95 | score p95 | score p99 | failed rate | checks rate | Decision | Report |',
    '| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...stageResults.map(renderStageRow),
    '',
    '## Issue decision matrix',
    '',
    '| Issue | First decision | Evidence rule |',
    '| --- | --- | --- |',
    `| #247 MATCH_SCORE bounded cache | ${cacheDecision} | score p95 >= 300ms or score p99 >= 1500ms in repeated stages escalates; p95 < 300ms and p99 < 1000ms through 25/50/100 keeps defer-candidate |`,
    '| #204/#205 Redis/cache | provisional only | this run detects repeated read/auth pressure, but local pg container evidence alone does not decide multi-node Redis/session strategy |',
    '| #256/#272 DB/materialization | provisional only | lock wait, CPU, and score latency spikes promote EXPLAIN/RDS follow-up; local stability does not replace RDS evidence |',
    '',
    '## Safety / cleanup contract',
    '',
    '- Production target is not used by this runner; it delegates to the production-like docker runner and its target guard.',
    '- Each stage uses a separate stress marker and report file so fixture reset/residue can be audited per VU step.',
    '- Raw token/ticket/cookie/password/email/DB URL values are left in ignored `.tmp-*` artifacts only while each delegated runner is active and are removed by that runner.',
    '- Default ramp skips bounded write mix and realtime smoke; enable them explicitly with `STRESS_237_RAMP_ENABLE_WRITE_MIX=true` or `STRESS_237_RAMP_ENABLE_REALTIME_SMOKE=true` after read/score stages are stable.',
    '',
  ].join('\n');

  writeFileSync(reportPath, redact(report), { mode: 0o600 });
}

function decideCacheOutcome({ completedStages, cacheEscalationStages }) {
  if (planOnly) {
    return 'not evaluated: plan-only';
  }
  if (stageResults.some((stage) => stage.decision === 'stop-latency-gate')) {
    return `escalate #247 bounded cache design; latency stop gate observed: ${stoppedReason || 'p95 reached 500ms stop gate'}`;
  }
  if (stoppedReason) {
    return `blocked by stop gate: ${stoppedReason}`;
  }
  if (cacheEscalationStages.length >= 2) {
    return 'escalate #247 bounded cache design';
  }
  const stableDecisionStages = completedStages.filter(
    (stage) => stage.decision === 'cache-defer-candidate',
  );
  if (stableDecisionStages.length >= 3) {
    return 'defer #247 cache; keep monitoring with 946/long-run evidence';
  }
  return 'needs manual review';
}

function renderStageRow(stage) {
  const report = relative(repoRoot, stage.reportPath);
  return [
    stage.id,
    stage.vus,
    stage.duration,
    stage.status,
    stage.exitCode ?? '',
    formatMetric(stage.baseline?.p95),
    formatMetric(stage.score?.p95),
    formatMetric(stage.score?.p99),
    formatMetric(stage.score?.failedRate),
    formatMetric(stage.score?.checksRate),
    stage.stopReason ? `${stage.decision}: ${stage.stopReason}` : stage.decision,
    report,
  ]
    .map((value) => escapeCell(String(value)))
    .join(' | ')
    .replace(/^/u, '| ')
    .replace(/$/u, ' |');
}

function formatMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function captureGit(command, args) {
  const result = spawnSync('git', [command, ...args], { cwd: repoRoot, encoding: 'utf8' });
  return String(result.stdout || '').trim();
}

function escapeCell(value) {
  return redact(value).replace(/\|/gu, '\\|').replace(/\n/gu, '<br>');
}

function redact(value) {
  return String(value)
    .replace(/postgresql:\/\/[^\s)]+/giu, 'postgresql://[REDACTED_STRESS_SECRET]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED_STRESS_SECRET]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_STRESS_SECRET]')
    .replace(/(TOKEN|SECRET|PASSWORD|DATABASE_URL)=([^\s]+)/giu, '$1=[REDACTED_STRESS_SECRET]');
}
