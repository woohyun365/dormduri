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

// A flag in a command span, read to its end: `--binding-out` stays one flag, never `--binding`.
const FLAG = /--[a-z]+(?:-[a-z]+)*/gu;
const flagsOf = (text) => [...text.matchAll(FLAG)].map(([flag]) => flag);

// The flags a command accepts: a CLI with subcommands lists each one's flags in its own `<subcommand>: [` or `{` entry,
// on one line or, for a longer entry, down to the line that closes it at the same indent.
function acceptedFlags(script, rest) {
  const [, file, fixed] = /node (\S+\.mjs)(?: ([a-z]+))?/u.exec(scripts[script]);
  const source = read(file);
  const subcommand = fixed ?? /^ -- ([a-z]+(?:-[a-z]+)*)(?= |$)/u.exec(rest)?.[1];
  if (subcommand === undefined) return source;
  const lines = source.split('\n');
  const opening = new RegExp(`^(\\s*)'?${subcommand}'?: ([[{])`, 'u');
  const at = lines.findIndex((text) => opening.test(text));
  assert.ok(at >= 0, `${script}: subcommand ${subcommand}`);
  const [, indent, bracket] = opening.exec(lines[at]);
  const closing = `${indent}${bracket === '[' ? ']' : '}'},`;
  const end = /[\]}],$/u.test(lines[at]) ? at : lines.indexOf(closing, at);
  assert.ok(end >= at, `${script}: subcommand ${subcommand} entry end`);
  const entry = lines.slice(at, end + 1).join('\n');
  assert.ok(entry.includes("'--"), `${script}: subcommand ${subcommand} flags`);
  return entry;
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
      for (const flag of flagsOf(rest))
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
  // One command selects the criteria, collects the context inputs and registers; its flags are the delegate CLI's.
  const [run] = [...review.matchAll(/`pnpm -s codex:delegate( -- review-run [^`]*)`/gu)];
  assert.ok(run, 'the review-run command');
  for (const flag of ['--lanes', '--token', '--round', '--paths', '--out'])
    assert.ok(flagsOf(run[1]).includes(flag), `review-run command gives ${flag}`);
  assert.deepEqual(flagsOf(' --binding-out a --lifecycle-out b -- p'), [
    '--binding-out',
    '--lifecycle-out',
  ]);
  const accepted = acceptedFlags('codex:delegate', run[1]);
  for (const flag of ['--criteria', '--lifecycle-draft']) {
    assert.ok(accepted.includes(`'${flag}'`), `review-run accepts ${flag}`);
    assert.ok(flat.includes(`\`${flag} `), `the skill names ${flag}`);
  }
  // The shared selection and context input modules do the work, as in the Claude entry.
  const delegate = read('scripts/agents/codex/delegate-spec.mjs');
  for (const module of ['review-criteria-selection.mjs', 'review-context-inputs.mjs'])
    assert.ok(delegate.includes(`'../common/${module}'`), `review-run imports ${module}`);
  assert.ok(
    flat.includes('`spawn-arguments.json`의 내용(`review-run.json`의 `spawnArguments`)을 그대로'),
    'spawn arguments come from the review-run output',
  );
  for (const path of [
    'docs/development/agent-workflows/adapters/codex-native-registry.md',
    'docs/development/agent-workflows/adapters/codex-delegation.md',
  ])
    assert.ok(read(path).includes('`review-child`'), `${path}: review-child`);
});

// F5: review-run saves the context input record and its two extracts under the session directory (step 2 names them),
// step 3 puts every `inputs[].path` in the reviewer read scope, and each input kind the module emits is named by both
// host documents (this skill's step 2 and the Claude same-host-review input paragraph).
const SESSION_DIR = '.artifacts/tools/codex-native/<sessionId>/';
// What each host document names for an input kind; a kind the module adds without a row here fails the test.
const KIND_TEXT = {
  intent: 'intent',
  decision: '결정 기록',
  policy: '정책 문서',
  'binding-values': '<reviewId>.binding.md',
  'lifecycle-draft': '<reviewId>.lifecycle.md',
};
test('knu-review saves the context inputs and both extracts and reads every input path, as the Claude entry does', async () => {
  const { REVIEW_CONTEXT_KINDS } = await import(`../../../agents/common/review-context-inputs.mjs`);
  assert.ok(
    Array.isArray(REVIEW_CONTEXT_KINDS),
    'review-context-inputs export REVIEW_CONTEXT_KINDS',
  );
  const steps = read(skillPath('knu-review')).split(/\n(?=\d+\. )/u);
  const flat = (step) => step.replace(/\s+/gu, ' ');
  const step1 = flat(steps.find((step) => step.startsWith('1. ')) ?? '');
  const step2 = flat(steps.find((step) => step.startsWith('2. ')) ?? '');
  const step3 = flat(steps.find((step) => step.startsWith('3. ')) ?? '');
  assert.ok(step1.includes('`--lifecycle-draft <경로>`'), 'step 1 gives the draft to review-run');
  // review-run writes each record where the skill says: the suffixes are the delegate CLI's.
  const delegate = read('scripts/agents/codex/delegate-spec.mjs');
  for (const suffix of ['.criteria.json', '.context.json', '.binding.md', '.lifecycle.md']) {
    assert.ok(delegate.includes(`record('${suffix}')`), `review-run writes <reviewId>${suffix}`);
    assert.ok(
      step2.includes(`${SESSION_DIR}<reviewId>${suffix}`),
      `step 2 names <reviewId>${suffix}`,
    );
  }
  assert.ok(
    step3.includes('`inputs[].path`를 읽기 범위에 넣고'),
    'step 3 puts every inputs[].path in the read scope',
  );
  const sameHost = read('docs/development/agent-workflows/adapters/claude-same-host-review.md');
  const inputParagraph = flat(
    sameHost.split('\n\n').find((paragraph) => paragraph.startsWith('리뷰어 입력은')) ?? '',
  );
  for (const kind of REVIEW_CONTEXT_KINDS) {
    assert.ok(KIND_TEXT[kind], `no host document text for input kind ${kind}`);
    assert.ok(step2.includes(KIND_TEXT[kind]), `Codex knu-review step 2 names ${kind}`);
    assert.ok(
      inputParagraph.includes(KIND_TEXT[kind]),
      `same-host-review input paragraph names ${kind}`,
    );
  }
});

test('knu-review step 3 points the plan review grade and the second-round delta at their rule documents', () => {
  const steps = read(skillPath('knu-review')).split(/\n(?=\d+\. )/u);
  const step3 = (steps.find((step) => step.startsWith('3. ')) ?? '').replace(/\s+/gu, ' ');
  for (const phrase of [
    'session-continuity.md#계획-초안-staging과-promote',
    'qa.md#리뷰-회차',
    '계획 리뷰 등급',
    '2회차부터 delta',
    '전 범위',
  ])
    assert.ok(step3.includes(phrase), `plan review grade: Codex step 3 ${phrase}`);
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

// P6 ② RED 8 and Owner 2026-11-21 1.2·1.3: the Codex settle skill keeps the disposition record file in the Claude
// format and states the same rules in the same words; the review skill points at the Codex same-host review reference.
test('the Codex settle skill keeps the disposition record file and its rules (P6 ② RED 8)', () => {
  const text = read(skillPath('knu-settle')).replace(/\s+/gu, ' ');
  for (const [pattern, label] of [
    [/`r<N>-adjudication\.json`\(`review-adjudication\/v1`/u, 'disposition record file'],
    [/재현되면 고친 뒤 `fixed`와 `fixRef`/u, 'fixed only after the fix, with its fixRef'],
    [/고치기 전에는 `fixed`를 쓰지 않습니다/u, 'no fixed before the fix'],
    [
      /처분 기록 `subject`는 회차와 무관한 변경 이름이고 같은 변경의 모든 회차가 같은 문자열을 씁니다/u,
      'one subject name for every round',
    ],
    [/2회차부터 finding마다 `origin`\(`fix-induced`·`previously-missed`·`re-raised`\)/u, 'origin'],
    [/rebase·squash로 SHA가 바뀌면 앞 회차 기록은 그대로 두고/u, 'rebase'],
    [
      /`sameTypeLocations`는 모두 고치거나 고치지 않은 위치를 그 finding 처분 `reason`에 남깁니다/u,
      'same type',
    ],
    [/`parent-checked`/u, 'parent-checked'],
    [/`pre-existing`/u, 'pre-existing'],
  ])
    assert.match(text, pattern, label);
  assert.ok(
    !text.includes('처분 기록 파일이 없습니다'),
    'older wording: no disposition record file',
  );
  assert.match(
    read(skillPath('knu-review')),
    /\]\(\.\.\/\.\.\/\.\.\/docs\/development\/agent-workflows\/adapters\/codex-same-host-review\.md(?:#[^)]*)?\)/u,
    'knu-review points at the Codex same-host review reference',
  );
});
