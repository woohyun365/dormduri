import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const intakeRoot = resolve(repoRoot, 'docs/development/agent-workflows/request-intake');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

test('request intake decisions preserve all accepted architecture boundaries', () => {
  const decisions = readFileSync(resolve(intakeRoot, 'decisions.md'), 'utf8');

  assert.match(decisions, /- 상태: accepted/u);
  for (let index = 1; index <= 12; index += 1) {
    assert.match(decisions, new RegExp(`AIPO-${String(index).padStart(3, '0')}`, 'u'));
  }
  assert.match(decisions, /mutation authority 분리/u);
  assert.match(decisions, /Single-first/u);
  assert.match(decisions, /Recovery는 한 번/u);
});

test('TaskEnvelope separates inferred intent from explicit action authority', () => {
  const contract = readFileSync(resolve(intakeRoot, 'task-envelope.md'), 'utf8');

  for (const field of [
    'requestId',
    'requestSummary',
    'intent',
    'authorizedAction',
    'risk',
    'domainCandidates',
    'constraints',
    'requiredEvidence',
    'ambiguities',
    'recommendedPath',
    'confidence',
  ]) {
    assert.match(contract, new RegExp(field, 'u'));
  }
  assert.match(contract, /Analyze requests cannot authorize `mutate`/u);
  assert.match(contract, /Plan requests authorize `produce-plan`, not implementation/u);
  assert.match(contract, /Raw prompts, secrets, credentials, transcripts/u);
});

test('Analyze and Plan outputs have non-overlapping completion contracts', () => {
  const contract = readFileSync(resolve(intakeRoot, 'output-contracts.md'), 'utf8');

  for (const field of ['facts', 'problems', 'recommendations', 'gaps', 'confidence']) {
    assert.match(contract, new RegExp(field, 'u'));
  }
  for (const field of [
    'planId',
    'decisions',
    'openQuestions',
    'dependencies',
    'phases',
    'verificationMatrix',
    'finalAcceptance',
  ]) {
    assert.match(contract, new RegExp(field, 'u'));
  }
  assert.match(contract, /user가 plan을 요청하지 않았다면 plan file을 생성하지 않는다/u);
  assert.match(contract, /plan을 작성했다는 이유로 구현을 시작하지 않는다/u);
});

test('ambiguity dispositions fail closed without blocking safe inspection', () => {
  const contract = readFileSync(resolve(intakeRoot, 'ambiguity-and-authority.md'), 'utf8');

  for (const disposition of [
    'clarify-now',
    'plan-oq',
    'release-evidence-handoff',
    'evidence-gap',
    'safe-read-only-first',
  ]) {
    assert.match(contract, new RegExp(disposition, 'u'));
  }
  assert.match(contract, /repository evidence\s*\| fact·domain·risk 보정\s*\| mutation authority/u);
  assert.match(contract, /ordinary reversible inspection은 질문 없이 진행/u);
});

test('workflow entry points discover the canonical request intake contract', () => {
  const workflowIndex = read('docs/development/agent-workflows/README.md');
  const gettingStarted = read('docs/development/agent-workflows/getting-started.md');
  const executionContract = read('docs/development/agent-workflows/agent-execution-contract.md');

  assert.match(workflowIndex, /request-intake\/README\.md/u);
  assert.match(gettingStarted, /request-intake\/README\.md/u);
  assert.match(executionContract, /request-intake\/README\.md/u);
});
