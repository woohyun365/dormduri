import { existsSync, mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The effort each tracked role file declares; fixture roles mirror it so registration binds it.
export const ROLE_EFFORT = {
  knu_explorer: 'high',
  knu_researcher: 'high',
  knu_executor: 'high',
  knu_executor_xhigh: 'xhigh',
  knu_reviewer: 'xhigh',
};
export function writeRole(root, role, tools, body = 'Bounded fixture role.') {
  writeFileSync(
    join(root, '.claude/agents', `${role}.md`),
    `---\nname: ${role}\ntools: ${tools}\neffort: ${ROLE_EFFORT[role]}\n---\n${body}\n`,
  );
}
// Writes a finished child transcript where Claude Code keeps it: beside the parent session
// transcript, under <session>/subagents/. Returns the parent transcript path a hook event names.
export function writeChildTranscript(
  root,
  { sessionId, agentId, prompt, model, effort, text = 'done' },
) {
  const base = join(realpathSync(root), '.artifacts/transcripts');
  mkdirSync(join(base, sessionId, 'subagents'), { recursive: true });
  const parentPath = join(base, `${sessionId}.jsonl`);
  if (!existsSync(parentPath)) writeFileSync(parentPath, '');
  const row = (type, message, extra = {}) =>
    JSON.stringify({ type, sessionId, agentId, ...extra, message });
  writeFileSync(
    join(base, sessionId, 'subagents', `agent-${agentId}.jsonl`),
    `${row('user', { content: prompt })}\n${row('assistant', { model, content: [{ type: 'text', text }] }, effort === undefined ? {} : { effort })}\n`,
  );
  return parentPath;
}
export function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'native-session-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.claude/agents'), { recursive: true });
  writeRole(root, 'knu_explorer', 'Read, Grep, Glob', 'Read only.');
  writeFileSync(join(root, 'sample.txt'), 'oracle');
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
  const head = git('rev-parse', 'HEAD').trim();
  const now = Date.now();
  const input = {
    root,
    request: 'sample.txt 내용을 분석해줘.',
    mode: 'fresh',
    currentSnapshot: {
      baseSHA: head,
      headSHA: head,
      dirtyDiffDigest: null,
      untrackedInputDigests: [],
    },
    directAssignment: {
      owner: 'explorer',
      dispatchId: 'native-1',
      acceptance: ['oracle returned'],
      writeOwnership: [],
    },
    reviewDisposition: {
      required: false,
      reason: 'bounded synthetic extraction independently checked by oracle',
    },
    nativeRequest: {
      profileId: 'bounded-extraction',
      selectedBy: 'lead',
      selectionBasisRef: 'test-case',
      issuedAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 60000).toISOString(),
      task: {
        taskId: 'task-1',
        kind: 'extract',
        impactRisk: 'low',
        complexity: 'bounded',
        uncertainty: 'resolved',
        role: 'knu_explorer',
        allowedTools: ['Read', 'Grep', 'Glob'],
        readScope: ['sample.txt'],
        writeScope: [],
        writeOwner: null,
        childValue: 'independent-extraction',
        independent: true,
        knownGaps: [],
        facts: [
          'source-bound',
          'fixed-input',
          'single-step',
          'output-schema',
          'acceptance',
          'independent-check',
        ].map((key) => ({ key, sourceRef: 'test-case', confidence: 'high' })),
      },
    },
  };
  const options = {
    prompt: 'Read sample.txt only.',
    expectedResolvedModel: 'claude-haiku-4-5-20251001',
    cliVersion: '2.1.283',
  };
  return { root, input, options };
}
