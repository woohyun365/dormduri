import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { recommendDelegation } from './child-task-contract.mjs';
import { discoverContextPack } from './domain-guide-registry.mjs';
import { buildTaskEnvelope } from './intake-policy.mjs';
import { createDispatchRecommendation } from './orchestration-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const entryPoints = Object.freeze([
  'AGENTS.md',
  'docs/development/agent-workflows/README.md',
  'docs/development/agent-workflows/getting-started.md',
  'docs/development/agent-workflows/agent-execution-contract.md',
  'docs/development/agent-workflows/request-intake/README.md',
  'docs/development/agent-workflows/plan-authoring/README.md',
  'docs/development/agent-workflows/orchestration.md',
]);

export function runFreshSessionSmoke() {
  const discovery = discoverBootstrap();
  const direct = evaluateScenario({
    request: 'AGENTS.md의 줄 수를 알려줘.',
    repositoryEvidence: [{ path: 'AGENTS.md', kind: 'changed-file' }],
  });
  const singleDomain = evaluateScenario({
    request: 'Legal Web UI 책임을 분석하고 개선 계획을 작성해줘.',
    repositoryEvidence: [
      { path: 'docs/policies/legal-basis.md', kind: 'policy' },
      { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
      { path: 'apps/web/src/legal/__tests__/legal-document-pages.test.tsx', kind: 'test' },
    ],
  });
  const mixedDomain = evaluateScenario({
    request: 'Legal Web/API 책임을 분석하고 개선 계획을 작성해줘.',
    repositoryEvidence: [
      { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
      { path: 'apps/api/src/legal/README.md', kind: 'owner-readme' },
    ],
  });
  const unavailableRoleRouting = evaluateScenario({
    request: 'Legal 개선 지점 분석해줘.',
    repositoryEvidence: [
      { path: 'docs/policies/legal-basis.md', kind: 'policy' },
      { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
    ],
    laneCandidates: advisoryLegalLanes(),
    roleRoutingAvailable: false,
    runtimeCapabilities: { nativeChildSurface: true, nativeRoleRouting: false },
  });

  return deepFreeze({
    schemaVersion: 1,
    discovery,
    scenarios: {
      direct: summarizeScenario(direct),
      singleDomain: summarizeScenario(singleDomain),
      mixedDomain: summarizeScenario(mixedDomain),
      unavailableRoleRouting: summarizeScenario(unavailableRoleRouting),
    },
    boundaries: {
      readsLocalResumeState: false,
      readsIgnoredPlan: false,
      invokesChild: false,
      mutatesWorkspace: false,
    },
  });
}

function discoverBootstrap() {
  for (const path of entryPoints) {
    if (!existsSync(resolve(repoRoot, path)))
      throw new Error(`Missing bootstrap entry point: ${path}`);
  }

  const agents = read('AGENTS.md');
  const workflowIndex = read('docs/development/agent-workflows/README.md');
  const gettingStarted = read('docs/development/agent-workflows/getting-started.md');

  requireReference(agents, 'docs/development/agent-workflows/getting-started.md', 'AGENTS.md');
  requireReference(agents, 'agent-execution-contract.md', 'AGENTS.md');
  requireReference(agents, 'orchestration.md', 'AGENTS.md');
  requireReference(workflowIndex, 'request-intake/README.md', 'workflow index');
  requireReference(workflowIndex, 'plan-authoring/README.md', 'workflow index');
  requireReference(gettingStarted, 'request-intake/README.md', 'getting started');
  requireReference(gettingStarted, 'plan-authoring/README.md', 'getting started');

  return {
    entryPoints: [...entryPoints],
    order: [
      'current-request',
      'AGENTS.md',
      'minimum-relevant-workflow-guide',
      'current-code-contract-test-evidence',
    ],
    canonical: true,
  };
}

function evaluateScenario({
  request,
  repositoryEvidence,
  laneCandidates = [],
  roleRoutingAvailable = true,
  runtimeCapabilities = { nativeChildSurface: false, nativeRoleRouting: false },
}) {
  assertRepositoryEvidenceExists(repositoryEvidence);
  const envelope = buildTaskEnvelope({ request });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence });
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates,
    roleRoutingAvailable,
  });
  const dispatch = createDispatchRecommendation({ delegation, runtimeCapabilities });

  return { envelope, contextPack, delegation, dispatch };
}

function summarizeScenario({ envelope, contextPack, delegation, dispatch }) {
  return {
    intent: envelope.intent,
    authorizedAction: envelope.authorizedAction,
    recommendedPath: envelope.recommendedPath,
    domains: contextPack.domainCandidates.map(({ domain }) => domain),
    selectedGuides: contextPack.selectedGuides.map(({ path }) => path),
    gaps: [...contextPack.gaps, ...delegation.gaps, ...dispatch.gaps],
    delegation: delegation.execution,
    delegationReason: delegation.reason,
    dispatch: dispatch.execution,
    dispatchReason: dispatch.reason,
    childCount: dispatch.dispatches.length,
    routedRoles: dispatch.dispatches.map(({ agentType }) => agentType),
  };
}

function advisoryLegalLanes() {
  return [
    {
      id: 'legal-repository',
      domain: 'legal-policy',
      taskKind: 'analysis',
      priority: 'high',
      risk: 'high',
      objective: 'Analyze current repository Legal responsibilities.',
      question: 'Which current repository boundaries affect Legal?',
      allowedEvidence: ['repo', 'test'],
      allowedTools: ['repository-read'],
      readScope: ['docs/policies/legal-basis.md', 'apps/web/src/legal'],
      writeOwnership: [],
      dependencies: [],
      expectedOutputFields: ['problems', 'recommendations'],
      verification: ['Cite current repository paths.'],
      benefit: {
        kind: 'completeness',
        rationale: 'Repository evidence can be inspected independently.',
      },
    },
    {
      id: 'legal-official',
      domain: 'legal-policy',
      taskKind: 'research',
      priority: 'high',
      risk: 'high',
      objective: 'Verify current official Legal evidence.',
      question: 'Which current official sources support the Legal claims?',
      allowedEvidence: ['official-current'],
      allowedTools: ['official-web-read'],
      readScope: ['https://www.law.go.kr/'],
      writeOwnership: [],
      dependencies: [],
      expectedOutputFields: ['currentClaims'],
      verification: ['Cite a directly verified official source.'],
      benefit: {
        kind: 'specialist-evidence',
        rationale: 'External authority can be checked independently.',
      },
    },
  ];
}

function assertRepositoryEvidenceExists(repositoryEvidence) {
  for (const { path } of repositoryEvidence) {
    if (!path.startsWith('https://') && !existsSync(resolve(repoRoot, path))) {
      throw new Error(`Missing repository evidence: ${path}`);
    }
  }
}

function requireReference(source, expected, owner) {
  if (!source.includes(expected)) throw new Error(`${owner} does not discover ${expected}`);
}

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(runFreshSessionSmoke(), null, 2)}\n`);
}
