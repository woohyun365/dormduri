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
];

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

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
  const fixturePath = 'scripts/ci/fixtures/visual-capability-cases.json';
  assert.equal(existsSync(resolve(repoRoot, fixturePath)), true);

  const cases = JSON.parse(read(fixturePath));
  assert.equal(cases.length, 4);

  const direct = cases.find((fixture) => fixture.id === 'ordinary-css-fix-direct-path');
  const figma = cases.find((fixture) => fixture.id === 'figma-evidence-no-mutation-authority');
  const localDesign = cases.find((fixture) => fixture.id === 'untracked-design-is-not-canonical');

  assert.equal(direct?.expectedCapability, 'direct');
  assert.ok(direct?.prohibitedActions.includes('connect-figma'));
  assert.ok(figma?.prohibitedActions.includes('write-to-figma'));
  assert.ok(figma?.prohibitedActions.includes('install-product-dependency'));
  assert.ok(localDesign?.prohibitedActions.includes('treat-untracked-design-as-canonical'));
});

test('durable visual guidance does not depend on a local plan or implementation phase', () => {
  for (const path of visualGuidePaths) {
    const source = read(path);

    assert.doesNotMatch(source, /\bPhase\s+\d+(?:[.-]\d+)?\b/u, path);
    assert.doesNotMatch(source, /\.omx\/plans\//u, path);
  }
});
