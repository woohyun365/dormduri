import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const workflowRoot = 'docs/development/agent-workflows';
const visualRoot = `${workflowRoot}/visual-design`;
const visualGuidePaths = [
  `${visualRoot}/README.md`,
  `${visualRoot}/visual-brief.md`,
  `${visualRoot}/figma-mcp-evidence.md`,
  `${visualRoot}/reference-content-contract.md`,
  `${visualRoot}/design-task-orchestration.md`,
  `${visualRoot}/design-review-and-acceptance.md`,
  `${visualRoot}/device-presentation-and-verification.md`,
  `${visualRoot}/web-semantic-token-contract.md`,
];
const entryPaths = [
  `${workflowRoot}/README.md`,
  `${workflowRoot}/getting-started.md`,
  `${workflowRoot}/agent-execution-contract.md`,
  `${workflowRoot}/orchestration.md`,
  `${workflowRoot}/plan-authoring/frontend.md`,
];
const cases = JSON.parse(read('scripts/ci/fixtures/visual-capability-cases.json'));
const authorities = new Set(['analyze', 'plan', 'propose-visual-direction', 'implement']);
const capabilities = new Set(['direct', 'visual-workflow', 'reference-review']);
const modes = new Set(['maintain', 'reimagine', 'new-surface']);
const artifactKinds = new Set(['local-prototype', 'owned-source', 'plan-document']);
const dispositions = new Set(['inspect', 'propose', 'plan', 'implement', 'review', 'report-gap']);
const evidenceKinds = new Set([
  'response',
  'tool-log',
  'tree-diff',
  'content-map',
  'render',
  'interaction-check',
  'screenshot-comparison',
  'review-disposition',
  'owner-choice',
]);
const sourcePriorities = new Set([
  'latest-user-request',
  'product-policy',
  'current-production-ui',
]);

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function nonempty(value, label) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, label);
}

function stringList(value, label, allowEmpty = false) {
  assert.ok(Array.isArray(value) && (allowEmpty || value.length > 0), label);
  for (const item of value) nonempty(item, label);
  assert.equal(new Set(value).size, value.length, label);
}

// Test-corpus integrity, not a runtime classifier or a judge of model prose/aesthetic quality.
// Parent passes only { request, ...input } to the pilot; all other fields are evaluator-only.
function validateCorpus(value) {
  assert.ok(Array.isArray(value) && value.length > 0);
  const ids = new Set();
  for (const item of value) {
    nonempty(item.id, 'id');
    assert.match(item.id, /^[a-z]+(?:-[a-z]+)*$/u);
    assert.ok(!ids.has(item.id), `duplicate ${item.id}`);
    ids.add(item.id);
    nonempty(item.request, item.id);
    if (item.evaluatorNotes !== undefined) nonempty(item.evaluatorNotes, item.id);
    assert.ok(authorities.has(item.expectedAuthority), item.id);
    assert.ok(capabilities.has(item.expectedCapability), item.id);
    stringList(item.prohibitedActions, item.id);
    assert.deepEqual(Object.keys(item.input).sort(), [
      'context',
      'mode',
      'permittedArtifacts',
      'sourcePaths',
      'surfaceId',
    ]);
    nonempty(item.input.surfaceId, item.id);
    nonempty(item.input.context, item.id);
    assert.ok(modes.has(item.input.mode), item.id);
    stringList(item.input.sourcePaths, item.id, true);
    for (const path of item.input.sourcePaths) {
      assert.match(path, /^(?:apps|docs|packages)\//u, item.id);
      assert.ok(!path.split('/').includes('..'), item.id);
      assert.ok(existsSync(resolve(repoRoot, path)), `${item.id}: ${path}`);
    }
    stringList(item.input.permittedArtifacts, item.id, true);
    for (const kind of item.input.permittedArtifacts) assert.ok(artifactKinds.has(kind), item.id);
    if (item.expectedAuthority === 'analyze') assert.deepEqual(item.input.permittedArtifacts, []);
    if (item.input.permittedArtifacts.includes('owned-source')) {
      assert.equal(item.expectedAuthority, 'implement', item.id);
      assert.ok(!item.prohibitedActions.includes('write-production'), item.id);
    }
    if (item.input.permittedArtifacts.includes('plan-document')) {
      assert.equal(item.expectedAuthority, 'plan', item.id);
    }
    if (item.expectedAuthority === 'plan') {
      assert.ok(
        item.input.permittedArtifacts.every((kind) => kind === 'plan-document'),
        item.id,
      );
    }
    if (item.sourcePriority) {
      stringList(item.sourcePriority, item.id);
      for (const source of item.sourcePriority) assert.ok(sourcePriorities.has(source), item.id);
    }
    assert.deepEqual(Object.keys(item.expectations).sort(), ['disposition', 'evidence', 'signals']);
    assert.ok(dispositions.has(item.expectations.disposition), item.id);
    if (item.expectations.disposition === 'implement')
      assert.equal(item.expectedAuthority, 'implement');
    if (item.expectations.disposition === 'plan') assert.equal(item.expectedAuthority, 'plan');
    stringList(item.expectations.signals, item.id);
    stringList(item.expectations.evidence, item.id);
    for (const kind of item.expectations.evidence) assert.ok(evidenceKinds.has(kind), item.id);
    assert.ok(
      !item.expectations.signals.some((signal) => item.prohibitedActions.includes(signal)),
      item.id,
    );
  }
}

test('visual fixture inputs and evaluator expectations have distinct validated boundaries', () => {
  validateCorpus(cases);
});

test('invalid visual fixture mutations fail integrity checks, not a cosmetic scoring heuristic', () => {
  validateCorpus(cases);
  const mutations = [
    (value) => value.push(structuredClone(value[0])),
    (value) => {
      value[0].request = ' ';
    },
    (value) => {
      value[0].input.mode = 'auto-redesign';
    },
    (value) => {
      value[0].expectedAuthority = 'auto-approve';
    },
    (value) => {
      value[0].expectedCapability = 'mandatory-swarm';
    },
    (value) => {
      value[0].input.expectedAnswer = 'PASS';
    },
    (value) => {
      value[0].input.evaluatorNotes = 'synthetic answer key';
    },
    (value) => {
      value[0].input.sourcePaths = ['DESIGN.md'];
    },
    (value) => {
      value[0].input.permittedArtifacts = ['write-to-figma'];
    },
    (value) => {
      value[0].expectations.disposition = 'owner-approved';
    },
    (value) => {
      value[0].expectations.signals = [];
    },
    (value) => {
      value[0].expectations.evidence = ['static-green-proves-beauty'];
    },
    (value) => {
      value[0].expectations.signals = [value[0].prohibitedActions[0]];
    },
    (value) => {
      value[0].prohibitedActions.push(value[0].prohibitedActions[0]);
    },
    (value) => {
      value.find((item) => item.expectedAuthority === 'analyze').input.permittedArtifacts = [
        'local-prototype',
      ];
    },
    (value) => {
      value[0].input.permittedArtifacts = ['owned-source'];
    },
    (value) => {
      value[0].expectations.disposition = 'implement';
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(cases);
    mutate(invalid);
    assert.throws(() => validateCorpus(invalid));
  }
});

test('initial critic inputs exclude the synthetic defect key and generator self-assessment', () => {
  const challenges = [
    ['generator-approval-is-not-owner', ['9.8/10', 'user approved']],
    ['missing-content-state-action', ['필수 표 생략', 'retry 추가', 'copy 완료 상태 누락']],
  ];
  for (const [id, withheld] of challenges) {
    const fixture = cases.find((item) => item.id === id);
    nonempty(fixture.evaluatorNotes, id);
    const childPacket = JSON.stringify({ request: fixture.request, ...fixture.input });
    for (const key of withheld) {
      assert.ok(fixture.evaluatorNotes.includes(key), id);
      assert.ok(!childPacket.includes(key), `${id}: evaluator-only key leaked`);
    }
  }
});

test('ordinary request entry points link to the canonical visual owner without a Figma prerequisite', () => {
  for (const path of entryPaths) {
    const links = [...read(path).matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)].map((match) => match[1]);
    assert.ok(
      links.some(
        (link) =>
          resolve(repoRoot, path, '..', link) === resolve(repoRoot, visualRoot, 'README.md'),
      ),
      path,
    );
  }
  for (const path of visualGuidePaths.slice(1)) {
    assert.ok(read(`${visualRoot}/README.md`).includes(`./${path.split('/').at(-1)}`), path);
  }
});

test('visual workflow has one tracked entry point and does not promote local DESIGN notes', () => {
  const workflowIndex = read(`${workflowRoot}/README.md`);
  const visualIndex = read(`${visualRoot}/README.md`);

  assert.match(workflowIndex, /visual-design\/README\.md/u);
  assert.match(visualIndex, /VisualBrief/u);
  assert.match(visualIndex, /untracked `DESIGN\.md`/u);
  assert.match(visualIndex, /non-canonical/u);
  assert.match(visualIndex, /product policy/u);
});

test('visual brief separates evidence, direction, authority, and verification', () => {
  const brief = read(`${visualRoot}/visual-brief.md`);

  for (const phrase of [
    'Target and user job',
    'Evidence and current problem',
    'Visual direction candidates',
    'Must-preserve semantics',
    'Mutation authority',
    'Responsive and accessibility',
    'Verification',
  ]) {
    assert.match(brief, new RegExp(phrase, 'u'));
  }

  assert.match(brief, /사용자 승인 전 production implementation 권한을 부여하지 않습니다/u);
  assert.match(brief, /BFF·API·product policy 변경 권한을 부여하지 않습니다/u);
});

test('Figma readiness treats Education conditionally and revalidates effective MCP access per session', () => {
  const figma = read(`${visualRoot}/figma-mcp-evidence.md`);

  assert.match(figma, /Figma Education account/u);
  assert.match(figma, /개발자·agent session마다 다시 확인/u);
  assert.match(
    figma,
    /과거 session에서 성공한 OAuth와 seat evidence를[\s\S]{0,100}상속하지 않습니다/u,
  );
  assert.match(figma, /Education을[\s\S]{0,80}Professional\/Organization tier로 추측하지 않/u);
  assert.match(figma, /`whoami`/u);
  assert.match(figma, /read-only smoke/u);
  assert.match(figma, /write-to-canvas/u);
  assert.match(figma, /repository에 credential/u);
  assert.match(figma, /fail-open/u);
});

test('baseline fixtures keep direct work direct and Figma evidence non-authoritative', () => {
  const direct = cases.find((fixture) => fixture.id === 'ordinary-css-fix-direct-path');
  const figma = cases.find((fixture) => fixture.id === 'figma-evidence-no-mutation-authority');
  const localDesign = cases.find((fixture) => fixture.id === 'untracked-design-is-not-canonical');
  const redesign = cases.find((fixture) => fixture.id === 'visual-redesign-no-backend-authority');

  assert.equal(redesign?.expectedAuthority, 'propose-visual-direction');
  for (const action of ['change-product-policy', 'change-bff-contract', 'change-api-contract']) {
    assert.ok(redesign?.prohibitedActions.includes(action));
  }
  assert.equal(direct?.expectedAuthority, 'implement');
  assert.equal(direct?.expectedCapability, 'direct');
  assert.ok(direct?.prohibitedActions.includes('connect-figma'));
  assert.equal(figma?.expectedAuthority, 'analyze');
  assert.ok(figma?.prohibitedActions.includes('write-to-figma'));
  assert.ok(figma?.prohibitedActions.includes('change-api-contract'));
  assert.ok(figma?.prohibitedActions.includes('install-product-dependency'));
  assert.equal(localDesign?.expectedAuthority, 'propose-visual-direction');
  assert.deepEqual(localDesign?.sourcePriority, [
    'latest-user-request',
    'product-policy',
    'current-production-ui',
  ]);
  assert.ok(localDesign?.prohibitedActions.includes('treat-untracked-design-as-canonical'));
});

test('visual corpus retains content, authority, style freedom and refinement challenges', () => {
  // Presence protects the regression surface; only observed pilot output can satisfy these expectations.
  const required = {
    'legal-content-preserving-reimagine': ['exact-public-content', 'distinct-composition'],
    'reference-aspects-not-foreign-content': ['aspect-map'],
    'missing-reference-evidence': ['explicit-gap'],
    'backoffice-independent-style': ['surface-scoped-inheritance'],
    'approved-glass-direction': ['contextual-style-review'],
    'vague-ai-feel': ['labelled-alternatives'],
    'hostile-reference-is-data': ['untrusted-reference'],
    'generator-approval-is-not-owner': ['independent-verdict'],
    'missing-content-state-action': ['hard-finding'],
    'prototype-only-boundary': ['artifact-scope'],
    'historical-style-is-not-authority': ['constraint-provenance'],
    'provisional-aesthetic-choices': ['craft-sketch', 'semantic-question'],
    'adjective-only-design-rationale': ['concrete-design-choices'],
    'bounded-visual-refinement': ['located-critique', 'keep-or-revert'],
    'visual-plan-no-implementation': ['scoped-plan'],
    'approved-visual-implementation': ['approved-revision-parity'],
  };
  for (const [id, signals] of Object.entries(required)) {
    const fixture = cases.find((item) => item.id === id);
    assert.ok(fixture, id);
    for (const signal of signals)
      assert.ok(fixture.expectations.signals.includes(signal), `${id}: ${signal}`);
  }
});

test('durable visual guidance does not depend on a local plan or implementation phase', () => {
  for (const path of [...visualGuidePaths, ...entryPaths]) {
    const source = read(path);

    assert.doesNotMatch(source, /\bPhase\s+\d+(?:[.-]\d+)?\b/u, path);
    assert.doesNotMatch(source, /\.omx\/plans\//u, path);
  }
});

test('frontend and visual consumers link directly to one presentation contract', () => {
  const canonical = resolve(repoRoot, visualRoot, 'device-presentation-and-verification.md');
  for (const path of [
    `${workflowRoot}/plan-authoring/frontend.md`,
    `${visualRoot}/README.md`,
    `${visualRoot}/visual-brief.md`,
    `${visualRoot}/design-review-and-acceptance.md`,
  ]) {
    const links = [...read(path).matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)];
    assert.ok(
      links.some(([, link]) => resolve(repoRoot, path, '..', link.split('#')[0]) === canonical),
      path,
    );
  }
  for (const path of visualGuidePaths) {
    for (const [, link] of read(path).matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)) {
      if (/^(?:https?:|#)/u.test(link)) continue;
      assert.ok(existsSync(resolve(repoRoot, path, '..', link.split('#')[0])), `${path}: ${link}`);
    }
  }
});

test('presentation guidance retains decision, ownership, adoption and evidence sections', () => {
  const guide = read(`${visualRoot}/device-presentation-and-verification.md`);
  // Finite document contract only: presence cannot prove semantic compliance or browser behavior.
  for (const phrase of [
    'shared-responsive',
    'split-presentation',
    'unchanged-out-of-scope',
    'Tailwind',
    '## 공통 행동과 표현 전용 state',
    '## 같은 URL과 rendering 안전',
    '## 변경할 때 점진 적용',
    '## Device verification packet',
    '## Mobile Web과 미래 Native',
    '## 읽기 전용 적용 예시',
    'advisory-policy',
    'model-mediated',
    'deterministic-static',
  ])
    assert.ok(guide.includes(phrase), phrase);
});

test('presentation corpus preserves incremental choices and negative evidence cases', () => {
  const required = {
    'presentation-small-responsive': ['shared-responsive', 'preserve-focus-close'],
    'presentation-distinct-ia': ['split-presentation', 'subtree-only', 'persistence-gap'],
    'presentation-shared-mutation': [
      'single-action-owner',
      'success-refresh-once',
      'failure-no-refresh',
    ],
    'presentation-local-state': ['view-local-state', 'shared-draft-owner', 'resize-focus-contract'],
    'presentation-unchanged-legacy': ['unchanged-out-of-scope', 'no-migration-required'],
    'presentation-functional-fix': ['unchanged-out-of-scope', 'required-behavior-fix'],
    'presentation-native-boundary': ['separate-native-renderer', 'verified-pure-contract-only'],
    'presentation-false-dual-device': ['desktop-evidence-gap', 'actual-viewport-input'],
    'presentation-assertion-transition': [
      'replacement-before-change',
      'preserve-semantic-regressions',
    ],
  };
  for (const [id, signals] of Object.entries(required)) {
    const fixture = cases.find((item) => item.id === id);
    assert.ok(fixture, id);
    for (const signal of signals)
      assert.ok(fixture.expectations.signals.includes(signal), `${id}: ${signal}`);
    assert.ok(fixture.prohibitedActions.includes('preemptive-screen-decomposition'), id);
  }
  const direct = cases.find((item) => item.id === 'presentation-small-responsive');
  assert.equal(direct.expectedCapability, 'direct');
  assert.equal(direct.expectedAuthority, 'implement');
  const gap = cases.find((item) => item.id === 'presentation-false-dual-device');
  assert.equal(gap.expectedAuthority, 'analyze');
  assert.equal(gap.expectations.disposition, 'report-gap');
});

test('token consumers link to one canonical styling contract', () => {
  const canonical = resolve(repoRoot, visualRoot, 'web-semantic-token-contract.md');
  for (const path of [
    `${workflowRoot}/plan-authoring/frontend.md`,
    `${visualRoot}/README.md`,
    `${visualRoot}/visual-brief.md`,
  ]) {
    const links = [...read(path).matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)];
    assert.ok(
      links.some(([, link]) => resolve(repoRoot, path, '..', link.split('#')[0]) === canonical),
      path,
    );
  }
});

test('token contract retains owner, adoption and unresolved-observation evidence boundaries', () => {
  const guide = read(`${visualRoot}/web-semantic-token-contract.md`);
  // Finite document shape only, not CSS resolution, accessibility or semantic proof.
  for (const phrase of [
    '## 현재 구현과 목표 계약',
    '## Namespace, mapping, theme, override',
    '## 변경할 때의 packet',
    '## 읽기 전용 적용 예시',
    '## 미확인 참조의 인계',
    '## 미래 Native와 검증 한계',
    'maintain',
    'reimagine',
    'unchanged',
    'advisory-policy',
    'model-mediated',
    'deterministic-static',
  ])
    assert.ok(guide.includes(phrase), phrase);
});

test('token corpus preserves role, theme, mode, no-op and future-renderer challenges', () => {
  const required = {
    'token-maintain-direct': ['affected-only', 'preserve-affected-baseline'],
    'token-approved-reimagine': ['replacement-before-change', 'no-palette-lock'],
    'token-different-theme': ['reject-name-only-alias', 'theme-resolution-gap'],
    'token-same-value-distinct-role': ['same-value-not-same-meaning'],
    'token-device-geometry': ['shared-meaning-distinct-values', 'consume-device-packet'],
    'token-unchanged-surface': ['unchanged', 'no-migration-required'],
    'token-unresolved-reference': ['owner-trigger-evidence', 'no-runtime-fix-claim'],
    'token-future-native': ['actual-second-renderer-trigger', 'web-owner-now'],
  };
  for (const [id, signals] of Object.entries(required)) {
    const fixture = cases.find((item) => item.id === id);
    assert.ok(fixture, id);
    for (const signal of signals)
      assert.ok(fixture.expectations.signals.includes(signal), `${id}: ${signal}`);
    assert.ok(fixture.prohibitedActions.includes('preemptive-token-migration'), id);
  }
  const direct = cases.find((item) => item.id === 'token-maintain-direct');
  assert.equal(direct.expectedAuthority, 'implement');
  assert.equal(direct.expectedCapability, 'direct');
  for (const id of ['token-different-theme', 'token-unresolved-reference']) {
    const gap = cases.find((item) => item.id === id);
    assert.equal(gap.expectedAuthority, 'analyze');
    assert.equal(gap.expectations.disposition, 'report-gap');
  }
});
