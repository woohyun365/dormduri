import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { buildDelegation } from '../../../agents/codex/delegate-spec.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const SKILL_ROOT = '.agents/skills';
const SKILLS = ['knu-delegate', 'knu-review', 'knu-settle', 'knu-workflow'];
const skillPath = (name) => `${SKILL_ROOT}/${name}/SKILL.md`;
const scripts = JSON.parse(read('package.json')).scripts;

function frontmatter(text) {
  const block = /^---\n([\s\S]*?)\n---\n/u.exec(text)?.[1];
  if (block === undefined) return null;
  return Object.fromEntries(
    block.split('\n').map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
}

// GitHub-style heading anchor, enough for the headings these skills link.
function anchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/gu, '-');
}

test('the repository skills are the four Parent procedures with Codex frontmatter', () => {
  assert.deepEqual(readdirSync(resolve(root, SKILL_ROOT)).sort(), SKILLS);
  for (const name of SKILLS) {
    const meta = frontmatter(read(skillPath(name)));
    assert.ok(meta, `${name}: frontmatter`);
    assert.deepEqual(Object.keys(meta).sort(), ['description', 'name'], name);
    assert.equal(meta.name, name);
    // Child roles turn these skills off; the description says so for a host that lists them anyway.
    assert.match(meta.description, /Codex Parent/u, name);
    assert.match(meta.description, /Child 역할에서는 쓰지 않습니다\.$/u, name);
  }
});

test('skills call only package scripts, with flags their command source accepts', () => {
  for (const name of SKILLS) {
    const text = read(skillPath(name));
    const commands = [...text.matchAll(/pnpm -s ([a-z]+:[a-z]+)([^`\n]*)/gu)];
    assert.ok(commands.length > 0, `${name}: commands`);
    for (const [command, script, rest] of commands) {
      assert.ok(scripts[script], `${name}: ${script} is a package script`);
      const source = read(/node (\S+\.mjs)/u.exec(scripts[script])[1]);
      for (const [flag] of rest.matchAll(/--[a-z]+/gu))
        assert.ok(source.includes(`'${flag}'`), `${name}: ${command} flag ${flag}`);
    }
  }
});

test('skills link the single source documents, and every link resolves', () => {
  for (const name of SKILLS) {
    const path = skillPath(name);
    const text = read(path);
    const links = [...text.matchAll(/\]\(([^)#\s]+)(?:#([^)\s]+))?\)/gu)];
    assert.ok(
      links.some(([, target]) => target.includes('docs/development/agent-workflows/')),
      `${name}: links its rule source`,
    );
    for (const [, target, fragment] of links) {
      const file = resolve(root, dirname(path), target);
      assert.ok(existsSync(file), `${name}: ${target}`);
      if (fragment === undefined) continue;
      const headings = [...readFileSync(file, 'utf8').matchAll(/^#+ (.+)$/gmu)].map(([, h]) =>
        anchor(h),
      );
      assert.ok(headings.includes(fragment), `${name}: ${target}#${fragment}`);
    }
  }
});

test('the Codex entry routes the repeated procedures to the four skills', () => {
  const entry = read('docs/development/agent-workflows/adapters/codex.md');
  const routing = entry.slice(entry.indexOf('## Skill과 workflow routing'));
  for (const name of SKILLS)
    assert.ok(
      routing.split('\n').some((line) => line.startsWith('- ') && line.endsWith(`: \`$${name}\``)),
      name,
    );
  assert.match(entry, /repository skill\(`\.agents\/skills`\)로 호출합니다/u);
});

test('the delegation template is a spec the delegate CLI accepts', () => {
  const block = /```json\n([\s\S]*?)\n```/u.exec(read(skillPath('knu-delegate')))?.[1];
  assert.ok(block, 'knu-delegate needs a json template');
  const spec = JSON.parse(block);
  assert.match(spec.dispatchToken, /^<.+>$/u, 'the token is a placeholder the Parent replaces');
  const out = buildDelegation({ ...spec, dispatchToken: 'tmpl1234' }, { root });
  assert.equal(out.dispatches.length, spec.lanes.length);
  // The evidence kinds the skill lists are the context pack's, read from its source.
  const kinds = /const EVIDENCE_KINDS = new Set\(\[([\s\S]*?)\]\);/u
    .exec(read('scripts/agents/common/domain-guide-registry.mjs'))?.[1]
    .match(/'[^']+'/gu)
    .map((kind) => kind.slice(1, -1));
  const listed = /`repositoryEvidence\[\]\.kind`는 ([\s\S]*?) 중 하나입니다/u
    .exec(read(skillPath('knu-delegate')))?.[1]
    .match(/`[^`]+`/gu)
    .map((kind) => kind.slice(1, -1));
  assert.deepEqual(listed, kinds);
  // Child roles disable every repository skill (the role contract test pins the table form).
  for (const file of readdirSync(resolve(root, '.codex/agents')))
    for (const name of SKILLS)
      assert.ok(
        read(`.codex/agents/${file}`).includes(`path = "../../${skillPath(name)}"`),
        `${file}: ${name}`,
      );
});
