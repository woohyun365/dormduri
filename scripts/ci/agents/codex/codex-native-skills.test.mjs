import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

// Loaded dynamically so a missing module fails only the test that uses it, with its own reason.
const { buildDelegation } = await import('../../../agents/codex/delegate-spec.mjs').catch(
  () => ({}),
);

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

// The flags a command accepts: a CLI with subcommands lists each one's flags on its own `<subcommand>: [` or `{` line.
function acceptedFlags(script, rest) {
  const [, file, fixed] = /node (\S+\.mjs)(?: ([a-z]+))?/u.exec(scripts[script]);
  const source = read(file);
  const subcommand = fixed ?? /^ -- ([a-z]+)\b/u.exec(rest)?.[1];
  if (subcommand === undefined) return source;
  const flagLine = new RegExp(`^\\s*${subcommand}: [[{].*'--`, 'u');
  const line = source.split('\n').find((text) => flagLine.test(text));
  assert.ok(line, `${script}: subcommand ${subcommand}`);
  return line;
}

// codex.md owns the skill call rule: package scripts, plus the repository CLIs it names in that rule.
test('skills call only package scripts and the CLIs codex.md names, with flags their command source accepts', () => {
  const callRule =
    read('docs/development/agent-workflows/adapters/codex.md')
      .replace(/\s+/gu, ' ')
      .match(/Skill은 이 문서가 안내하는 .*?만 호출하고/u)?.[0] ?? '';
  assert.ok(callRule, 'codex.md skill call rule');
  for (const name of SKILLS) {
    const text = read(skillPath(name));
    const commands = [...text.matchAll(/pnpm -s ([a-z]+:[a-z]+)([^`\n]*)/gu)];
    assert.ok(commands.length > 0, `${name}: commands`);
    for (const [command, script, rest] of commands) {
      assert.ok(scripts[script], `${name}: ${script} is a package script`);
      const accepted = acceptedFlags(script, rest);
      for (const [flag] of rest.matchAll(/--[a-z]+/gu))
        assert.ok(accepted.includes(`'${flag}'`), `${name}: ${command} flag ${flag}`);
    }
    for (const [, file] of text.matchAll(/`node (scripts\/[^\s`]+\.mjs)/gu))
      assert.ok(
        callRule.includes(`\`${file}\``),
        `${name}: ${file} is not in the codex.md call rule`,
      );
  }
});

// codex.md step 6: compare and run independent QA first, then accept; an accepted child gets no followup.
test('settling compares the result and runs independent QA before it accepts', () => {
  const steps = read(skillPath('knu-settle')).split(/\n(?=\d+\. )/u);
  const at = (pattern) => steps.findIndex((step) => pattern.test(step));
  const accept = at(/codex:accept/u);
  for (const before of [/codex:completion/u, /oracle/u, /\$knu-review/u])
    assert.ok(at(before) >= 0 && at(before) < accept, `knu-settle: ${before} before codex:accept`);
  const entry = read('docs/development/agent-workflows/adapters/codex.md');
  assert.ok(entry.indexOf('oracle/회귀·독립 결과를 대조') < entry.indexOf('pnpm codex:accept'));
});

// The review entry takes code review requests and picks criteria from the changed paths with the shared selection CLI
// (the Claude entry's rule source), recording each review's choice. A host's own review (built-in /review, Codex Ultra
// or fork children) is an advisory opinion; the evidence is the registered reviewer child's observation only. The hook
// denies a follow-up or message to a reviewer (review-child), so a further question is a new round.
test('knu-review is the code review entry with automatic criteria and advisory host reviews', () => {
  const review = read(skillPath('knu-review'));
  const { description } = frontmatter(review);
  for (const phrase of ['code review', '리뷰해줘']) assert.ok(description.includes(phrase), phrase);
  const flat = review.replace(/\s+/gu, ' ');
  for (const host of ['`/review`', 'Codex Ultra', 'fork'])
    assert.ok(flat.includes(host), `host review: ${host}`);
  assert.ok(flat.includes('보조 의견'), 'host review results are advisory');
  assert.ok(
    flat.includes('등록·spawn한 reviewer child의 관측'),
    'evidence is the registered reviewer',
  );
  assert.ok(flat.includes('review-criteria/README.md#자동-선택'), 'the selection rule source');
  assert.ok(flat.includes('<reviewId>.criteria.json'), 'names the selection record');
  assert.ok(flat.includes('--criteria'), 'names the override');
  assert.ok(flat.includes('`review-child`'), 'a reviewer takes no follow-up');
  // The selection runs the shared CLI with flags its source accepts.
  const commands = [...review.matchAll(/`node (scripts\/agents\/common\/[^\s`]+\.mjs)([^`]*)`/gu)];
  assert.ok(
    commands.some(([, file]) => file === 'scripts/agents/common/review-criteria-selection.mjs'),
    'the shared selection CLI',
  );
  for (const [command, file, rest] of commands) {
    assert.ok(existsSync(resolve(root, file)), file);
    for (const [flag] of rest.matchAll(/--[a-z]+/gu))
      assert.ok(read(file).includes(`'${flag}'`), `${command} flag ${flag}`);
  }
  // The CLI reads every argument after `--` as a path, so the override shows --criteria before it.
  const selection = commands.filter(
    ([, file]) => file === 'scripts/agents/common/review-criteria-selection.mjs',
  );
  for (const [command, , rest] of selection)
    assert.ok(!/(^|\s)--[a-z]/u.test(rest.split(' -- ')[1] ?? ''), `${command}: flag after --`);
  assert.ok(
    selection.some(([, , rest]) => rest.split(' -- ')[0].includes('--criteria')),
    'override command puts --criteria before --',
  );
  assert.ok(
    /`registered\[\]`의 `spawnArguments`/u.test(flat),
    'spawn arguments come from the register output',
  );
  for (const path of [
    'docs/development/agent-workflows/adapters/codex-native-registry.md',
    'docs/development/agent-workflows/adapters/codex-delegation.md',
  ])
    assert.ok(read(path).includes('`review-child`'), `${path}: review-child`);
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
      `${name} in the Codex entry skill routing`,
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
  // The XHigh signals the skill names are the routing ones.
  assert.match(
    read('scripts/agents/codex/routing-policy.mjs'),
    /const DIRECT_XHIGH_DOMAIN_PREDICATES = /u,
  );
  assert.match(read(skillPath('knu-delegate')), /`DIRECT_XHIGH_DOMAIN_PREDICATES`/u);
  // Child roles disable every repository skill (the role contract test pins the table form).
  for (const file of readdirSync(resolve(root, '.codex/agents')))
    for (const name of SKILLS)
      assert.ok(
        read(`.codex/agents/${file}`).includes(`path = "../../${skillPath(name)}"`),
        `${file}: ${name}`,
      );
});
