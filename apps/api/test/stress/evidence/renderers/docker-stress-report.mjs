import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { escapeStressTableCell, redactStressEvidence } from '../stress-evidence-redaction.mjs';

export function writeDockerStressReport(input) {
  const {
    reportPath,
    authPasswordCapacityRun,
    productionLikeRun,
    localRehearsalRun,
    runProfile,
    targetUrl,
    useObservability,
    skipBuild,
    skipWriteMix,
    skipRealtimeSmoke,
    continueOnStressFailure,
    commandResults,
    evidence,
    stressEnv,
    gitCommit,
    gitBranch,
    gitDirty,
    authPasswordCapacityProfile,
  } = input;
  mkdirSync(dirname(reportPath), { recursive: true });
  const report = [
    authPasswordCapacityRun
      ? '# API Argon2id password capacity evidence result'
      : productionLikeRun
        ? '# API production-like docker stress evidence result'
        : '# API dockerized stress smoke result',
    '',
    `- generatedAt: ${new Date().toISOString()}`,
    `- gitCommit: ${gitCommit}`,
    `- gitBranch: ${gitBranch}`,
    `- gitDirty: ${gitDirty ? 'true' : 'false'}`,
    `- runProfile: ${runProfile}`,
    `- authPasswordCapacityProfile: ${
      authPasswordCapacityRun ? authPasswordCapacityProfile : 'disabled'
    }`,
    `- targetClass: ${
      localRehearsalRun
        ? 'local constrained 4GB/2CPU docker API/nginx/observability/PostgreSQL'
        : productionLikeRun
          ? 'local production-like docker nginx/API/PostgreSQL'
          : 'local docker API/nginx'
    }`,
    `- targetUrl: ${targetUrl}`,
    `- fixtureCohortSize: ${stressEnv.STRESS_COHORT_SIZE}`,
    `- fixtureLargestCohortSize: ${stressEnv.STRESS_LARGEST_COHORT_SIZE}`,
    `- tokenActorLimit: ${stressEnv.STRESS_TOKEN_ACTOR_LIMIT}`,
    `- observabilityEnabled: ${useObservability ? 'true' : 'false'}`,
    `- localRehearsal: ${localRehearsalRun ? 'true' : 'false'}`,
    `- skippedBuild: ${skipBuild ? 'true' : 'false'}`,
    `- skippedWriteMix: ${skipWriteMix ? 'true' : 'false'}`,
    `- skippedRealtimeSmoke: ${skipRealtimeSmoke ? 'true' : 'false'}`,
    `- continueOnStressFailure: ${continueOnStressFailure ? 'true' : 'false'}`,
    '- rawArtifacts: removed from ignored .tmp-* paths after report generation',
    '',
    '## Local resource boundary',
    '',
    localRehearsalRun
      ? [
          `- Docker engine: ${evidence.localRehearsalCapacity?.actualCpus ?? 'unknown'} CPU / ${evidence.localRehearsalCapacity?.actualMemoryMiB ?? 'unknown'}MiB`,
          '- API/nginx와 observability는 repository rehearsal override의 container limit을 사용했다.',
          '- Web/BackOffice runtime은 현재 compose에 포함되지 않는다. 정책 budget의 576MiB limit은 결과 해석 시 미사용 headroom으로 남긴다.',
          '- 이 결과는 local constrained evidence이며 managed PostgreSQL 또는 external host capacity를 증명하지 않는다.',
        ].join('\n')
      : '- status: not a constrained local rehearsal',
    '',
    '## Command results',
    '',
    '| Command | Status | Exit | Note |',
    '| --- | --- | ---: | --- |',
    ...commandResults.map(
      (result) =>
        `| ${escapeCell(result.name)} | ${result.status} | ${result.exitCode ?? ''} | ${escapeCell(result.note || '')} |`,
    ),
    '',
    '## HTTP boundary',
    '',
    `- health: ${formatHttp(evidence.health)}`,
    `- readiness: ${formatHttp(evidence.readiness)}`,
    `- metrics without bearer: ${formatHttp(evidence.metricsUnauthorized)} (expected 401)`,
    `- metrics with bearer: ${formatHttp(evidence.metricsAuthorized)} (expected 200; token omitted)`,
    '',
    '## Observability readout',
    '',
    useObservability
      ? [
          `- prometheus readiness: ${formatHttp(evidence.observabilityReadiness)}`,
          `- prometheus api up query: ${formatHttp(evidence.prometheusApiUp)}`,
          '- Grafana/Loki/Alloy UI endpoints are local-only; use the compose readout below for service state.',
        ].join('\n')
      : '- status: disabled for this run profile',
    '',
    '## k6 summaries',
    '',
    '| Scenario | Duration ms | http_req_duration p95 | http_req_duration p99 | http_req_failed rate | checks rate |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    renderK6Row('smoke', evidence.k6Smoke),
    renderK6Row('baseline-250', evidence.k6Baseline),
    renderK6Row('auth-login-capacity', evidence.k6AuthLogin),
    renderK6Row('auth-password-burst', evidence.k6AuthPasswordCapacity),
    renderK6Row('score-cohort-946', evidence.k6Score),
    renderK6Row('bounded-write-mix', evidence.k6Write),
    '',
    '## Auth password capacity decision',
    '',
    '```json',
    JSON.stringify(evidence.authPasswordCapacityDecision ?? { status: 'not-run' }, null, 2),
    '```',
    '',
    '## Artillery summary',
    '',
    renderArtillerySummary(evidence.artillerySmoke),
    '',
    '## Docker readout',
    '',
    '```txt',
    evidence.dockerPs || '(not captured)',
    '',
    evidence.observabilityPs || '(observability not enabled)',
    '',
    evidence.dockerStats || '(not captured)',
    '```',
    '',
    '## Docker resource limits',
    '',
    '```txt',
    evidence.dockerResourceLimits || '(not collected)',
    '```',
    '',
    '## PostgreSQL readout',
    '',
    '```txt',
    evidence.postgresBefore || '(before snapshot not captured)',
    '',
    evidence.h9AuthSecurityEvents
      ? `h9_auth_security_events\n${evidence.h9AuthSecurityEvents}`
      : '(H9 auth security event snapshot not applicable)',
    '',
    evidence.postgresAfter || '(after snapshot not captured)',
    '',
    evidence.markerResidue || '(marker residue not captured)',
    '```',
    '',
    '## Docker logs tail',
    '',
    '```txt',
    evidence.dockerLogs || '(not captured)',
    '```',
    '',
    '## Safety',
    '',
    '- raw token/ticket/cookie/password/email/DB URL/webhook 값은 이 report에 기록하지 않았다.',
    '- fixture reset은 marker prefix 기반 best-effort cleanup으로 실행했다.',
    '- `.env.api`는 local private file이며 커밋 대상이 아니다.',
    '',
  ].join('\n');

  writeFileSync(reportPath, redact(report), { mode: 0o600 });
}

function formatHttp(result) {
  if (!result) {
    return 'not captured';
  }
  return `http ${result.status}, bytes ${result.bodyLength}`;
}

function renderK6Row(name, summary) {
  const metric =
    summary?.metrics?.http_req_duration?.values ?? summary?.metrics?.http_req_duration ?? {};
  const failed =
    summary?.metrics?.http_req_failed?.values ?? summary?.metrics?.http_req_failed ?? {};
  const checks = summary?.metrics?.checks?.values ?? summary?.metrics?.checks ?? {};
  return [
    name,
    summary?.state?.testRunDurationMs ?? '',
    metric['p(95)'] ?? metric.p95 ?? '',
    metric['p(99)'] ?? metric.p99 ?? '',
    failed.rate ?? failed.value ?? '',
    checks.rate ?? checks.value ?? '',
  ]
    .map((value) => escapeCell(String(value)))
    .join(' | ')
    .replace(/^/u, '| ')
    .replace(/$/u, ' |');
}

function renderArtillerySummary(summary) {
  if (!summary) {
    return '- status: skipped or no artifact';
  }
  const aggregate = summary.aggregate ?? summary;
  const counters = aggregate.counters ?? {};
  const summaries = aggregate.summaries ?? aggregate.histograms ?? {};
  return [
    `- vusers.created: ${counters['vusers.created'] ?? ''}`,
    `- vusers.completed: ${counters['vusers.completed'] ?? ''}`,
    `- vusers.failed: ${counters['vusers.failed'] ?? ''}`,
    `- socketio.response_time.p95: ${summaries['socketio.response_time']?.p95 ?? ''}`,
    `- subscribeAck.p95: ${summaries['stress.realtime.subscribe_ack_ms']?.p95 ?? ''}`,
  ].join('\n');
}

function escapeCell(value) {
  return escapeStressTableCell(value);
}
function redact(value) {
  return redactStressEvidence(value);
}
