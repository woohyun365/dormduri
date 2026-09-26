import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function isIgnored(path) {
  const result = spawnSync('git', ['check-ignore', '-q', path], { cwd: root });
  assert.ok([0, 1].includes(result.status), result.stderr?.toString());
  return result.status === 0;
}

test('Claude entry imports the shared repository contract without copying it', () => {
  const source = read('CLAUDE.md');

  assert.match(source, /^@AGENTS\.md\s*$/mu);
  assert.ok(source.split('\n').length <= 35, 'Claude entry must remain a small adapter');
  assert.equal(isIgnored('CLAUDE.md'), false);
  assert.match(source, /docs\/development\/agent-workflows\/adapters\/claude-code\.md/u);
});

test('four project Claude agents declare bounded native tools', () => {
  const readOnly = new Set(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch']);

  for (const role of ['explorer', 'researcher', 'executor', 'reviewer']) {
    const path = `.claude/agents/knu_${role}.md`;
    const source = read(path);
    const frontmatter = /^---\n([\s\S]*?)\n---/u.exec(source)?.[1];
    assert.ok(frontmatter, `${path}: missing YAML frontmatter`);
    assert.match(frontmatter, new RegExp(`^name: knu_${role}$`, 'mu'));
    assert.match(frontmatter, /^description: .+$/mu);

    const tools = /^tools: (.+)$/mu
      .exec(frontmatter)?.[1]
      ?.split(',')
      .map((item) => item.trim());
    assert.ok(tools?.length, `${path}: explicit tools required`);
    assert.equal(new Set(tools).size, tools.length, `${path}: duplicate tool`);
    assert.ok(!tools.includes('Agent'), `${path}: child re-delegation is not allowed`);
    assert.doesNotMatch(frontmatter, /^permissionMode: bypassPermissions$/mu);
    if (role === 'executor') {
      assert.ok(tools.includes('Edit') && tools.includes('Bash'));
    } else {
      assert.ok(
        tools.every((tool) => readOnly.has(tool)),
        `${path}: read-only role has write-capable tool`,
      );
    }
    assert.equal(isIgnored(path), false, `${path}: project role must be portable`);
    assert.match(source, /docs\/development\/agent-workflows\//u);
  }
});

test('Claude private runtime state stays ignored while both host adapters have entry points', () => {
  for (const path of [
    '.claude/settings.local.json',
    '.claude/projects/example/session.json',
    '.claude/agents/private-draft.md',
    '.omc/session.json',
    '.omx/state/example.json',
  ]) {
    assert.equal(isIgnored(path), true, `${path}: private runtime data must remain ignored`);
  }

  for (const path of [
    'docs/development/agent-workflows/adapters/README.md',
    'docs/development/agent-workflows/adapters/codex.md',
    'docs/development/agent-workflows/adapters/claude-code.md',
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, `${path}: missing adapter entry`);
  }

  assert.match(read('docs/development/agent-workflows/orchestration.md'), /Codex.*adapter/u);
  assert.match(
    read('docs/development/agent-workflows/agentic-architecture-decisions.md'),
    /Codex.*cohort/u,
  );
});

test('project Claude visual skills are allowlisted with reviewed source and Codex-only qualification', () => {
  for (const skill of ['design-taste-frontend', 'redesign-existing-projects']) {
    const base = `.claude/skills/${skill}`;
    const source = read(`${base}/SKILL.md`);
    const provenance = JSON.parse(read(`${base}/SOURCE.json`));
    const hash = createHash('sha256').update(source).digest('hex');
    assert.equal(hash, provenance.sha256, `${skill}: source drift requires re-review`);
    assert.equal(provenance.commit, 'c184364c58658b2f131b4ae8bd3d206cabb3deee');
    assert.match(read(`${base}/LICENSE`), /MIT License/u);
    assert.match(provenance.qualification, /Codex|codex/u);
    for (const file of ['SKILL.md', 'LICENSE', 'SOURCE.json']) {
      assert.equal(isIgnored(`${base}/${file}`), false, `${base}/${file}: not portable`);
    }
    assert.equal(isIgnored(`${base}/local-notes.md`), true);
  }
});
