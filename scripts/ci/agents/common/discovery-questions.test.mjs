import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

// Loaded in each test so that a missing or broken helper fails every test with its own reason.
const helper = () => import('../../../agents/common/discovery-questions.mjs');

const root = resolve(import.meta.dirname, '../../../..');
const FIXTURE = 'scripts/ci/agents/common/fixtures/discovery/pack';
const PACK = 'docs/development/agent-workflows/domain/swe-web';
const CLI = 'scripts/agents/common/discovery-questions.mjs';

// The fixture pack as the helper reads it: every Markdown file directly under the pack directory.
function fixture() {
  const dir = resolve(root, FIXTURE);
  const names = readdirSync(dir).filter((name) => name.endsWith('.md'));
  return {
    path: FIXTURE,
    documents: Object.fromEntries(
      names.sort().map((name) => [name, readFileSync(resolve(dir, name), 'utf8')]),
    ),
  };
}
// One fixture document with a single text replacement; the replaced text must exist so a stale case cannot pass.
function changed(document, from, to) {
  const pack = fixture();
  assert.ok(pack.documents[document].includes(from), `${document}: ${from}`);
  return {
    ...pack,
    documents: { ...pack.documents, [document]: pack.documents[document].replace(from, to) },
  };
}
const ids = (decisions) => decisions.map(({ id }) => id);
const cli = (...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8' });

test('pack rule: one-way and depended-on costly decisions are irreversible, costly alone and easy are not', async () => {
  const { analyzeDomainPack } = await helper();
  const result = analyzeDomainPack(fixture());
  const decisions = result.sublayers.flatMap((sublayer) => sublayer.decisions);
  assert.deepEqual(
    Object.fromEntries(
      decisions.map(({ id, reversal, irreversible }) => [id, [reversal, irreversible]]),
    ),
    {
      'alpha.one.style': ['one-way', true],
      'alpha.one.layout': ['costly', true],
      'alpha.one.copy': ['easy', false],
      'alpha.two.cache': ['costly', false],
      'alpha.two.naming': ['easy', false],
      'beta.three.retention': ['costly', true],
    },
  );
  assert.deepEqual(
    result.sublayers.map(({ id, document, decisionFile }) => [id, document, decisionFile]),
    [
      ['Fixture/Pack/Alpha/one', 'alpha.md', 'docs/architecture/decisions/alpha.md'],
      ['Fixture/Pack/Alpha/two', 'alpha.md', 'docs/architecture/decisions/alpha.md'],
      ['Fixture/Pack/beta/three', 'beta.md', 'docs/architecture/decisions/beta.md'],
    ],
  );
  const layout = decisions.find(({ id }) => id === 'alpha.one.layout');
  assert.deepEqual(layout, {
    id: 'alpha.one.layout',
    level: 'framework-pattern',
    question: '화면 배치를 고정할까, 바꿀 수 있게 할까?',
    options: [
      '고정: 배치를 하나로 둔다. 단순하지만 바꿀 때 전부 고친다',
      '교체: 배치를 바꿀 수 있게 둔다. 유연하지만 경계가 늘어난다',
    ],
    dependsOn: ['alpha.one.style'],
    reversal: 'costly',
    reversalNote: '배치를 쓰는 곳을 모두 고친다',
    default: '고정. 화면이 적을 때는 충분하다. 화면이 늘면 교체를 고른다',
    confirmationCue: '`{{binding:repo-structure.alpha-layout}}`',
    criteria: '없음',
    irreversible: true,
  });
});

test('decisions come in dependency order, and a selection names prerequisites outside it', async () => {
  const { analyzeDomainPack } = await helper();
  const pack = fixture();
  assert.deepEqual(analyzeDomainPack(pack).order, [
    'alpha.one.style',
    'alpha.one.layout',
    'alpha.one.copy',
    'beta.three.retention',
    'alpha.two.cache',
    'alpha.two.naming',
  ]);
  const two = analyzeDomainPack(pack, { sublayers: ['Fixture/Pack/Alpha/two'] });
  assert.deepEqual(
    two.sublayers.map(({ id }) => id),
    ['Fixture/Pack/Alpha/two'],
  );
  assert.deepEqual(two.order, ['alpha.two.cache', 'alpha.two.naming']);
  assert.deepEqual(two.outsidePrerequisites, [
    'alpha.one.layout',
    'alpha.one.copy',
    'beta.three.retention',
  ]);
  // Irreversibility is a pack fact: a selection that hides the dependent decision does not change it.
  const three = analyzeDomainPack(pack, { sublayers: ['Fixture/Pack/beta/three'] });
  assert.equal(three.sublayers[0].decisions[0].irreversible, true);
});

test('the risk list of each sublayer is read back for comparison', async () => {
  const { analyzeDomainPack } = await helper();
  assert.deepEqual(
    analyzeDomainPack(fixture()).sublayers.map(({ id, irreversibleListed }) => [
      id,
      irreversibleListed,
    ]),
    [
      ['Fixture/Pack/Alpha/one', ['alpha.one.style', 'alpha.one.layout']],
      ['Fixture/Pack/Alpha/two', []],
      ['Fixture/Pack/beta/three', ['beta.three.retention']],
    ],
  );
});

test('a malformed pack or selection fails instead of returning a partial question space', async () => {
  const { analyzeDomainPack } = await helper();
  for (const [name, pack, options, pattern] of [
    [
      'unknown sublayer',
      fixture(),
      { sublayers: ['Fixture/Pack/Alpha/four'] },
      /unknown sublayer/u,
    ],
    [
      'unknown dependency',
      changed(
        'alpha.md',
        '- 먼저 정할 결정: `alpha.one.layout`\n- 되돌림: `easy`',
        '- 먼저 정할 결정: `alpha.one.missing`\n- 되돌림: `easy`',
      ),
      {},
      /unknown decision alpha\.one\.missing/u,
    ],
    [
      'cycle',
      changed(
        'alpha.md',
        '- 먼저 정할 결정: 없음\n- 되돌림: `one-way`',
        '- 먼저 정할 결정: `alpha.one.copy`\n- 되돌림: `one-way`',
      ),
      {},
      /dependency cycle/u,
    ],
    [
      'missing field',
      changed('beta.md', '- 확인 단서: `{{binding:policy.retention}}`\n', ''),
      {},
      /beta\.three\.retention: missing field 확인 단서/u,
    ],
    [
      'reversal value',
      changed('alpha.md', '- 되돌림: `one-way`', '- 되돌림: `hard`'),
      {},
      /alpha\.one\.style: reversal/u,
    ],
    [
      'risk list line missing',
      changed(
        'alpha.md',
        '- 비가역 선택: 없음. `alpha.two.cache`는',
        '- 참고: `alpha.two.cache`는',
      ),
      {},
      /Fixture\/Pack\/Alpha\/two: missing 비가역 선택/u,
    ],
    [
      'risk section missing',
      changed('beta.md', '### 위험\n', '### 참고\n'),
      {},
      /Fixture\/Pack\/beta\/three: missing ### 위험/u,
    ],
    [
      'risk list format',
      changed(
        'beta.md',
        '- 비가역 선택: `beta.three.retention`(`costly`',
        '- 비가역 선택: beta.three.retention(costly',
      ),
      {},
      /Fixture\/Pack\/beta\/three: malformed 비가역 선택/u,
    ],
    [
      'layer table mismatch',
      changed('README.md', '`one`, `two`', '`one`, `two`, `four`'),
      {},
      /layer table/u,
    ],
  ])
    assert.throws(() => analyzeDomainPack(pack, options), pattern, name);
});

test('the skeleton lists decision record entries under their sublayer with the pack link', async () => {
  const { analyzeDomainPack, renderDecisionSkeleton } = await helper();
  const skeleton = renderDecisionSkeleton(
    analyzeDomainPack(fixture(), { sublayers: ['Fixture/Pack/Alpha/two'] }),
  );
  const link = `../../../${FIXTURE}/alpha.md#alphatwocache`;
  assert.equal(
    skeleton.split('\n#### alpha.two.naming')[0],
    [
      '<!-- docs/architecture/decisions/alpha.md -->',
      '',
      '## two',
      '',
      '#### alpha.two.cache',
      '',
      '- 판정:',
      '- 상태:',
      '- 고른 선택지:',
      '- 근거:',
      '- 기각한 대안:',
      '- 재검토 조건:',
      '- 출처:',
      `- pack 결정: [alpha.two.cache](${link})`,
      '',
    ].join('\n'),
  );
  assert.doesNotMatch(skeleton, /alpha\.one\./u);
  // The layer file comment names the irreversible decisions that the gate will ask the Owner to confirm.
  assert.equal(
    renderDecisionSkeleton(
      analyzeDomainPack(fixture(), { sublayers: ['Fixture/Pack/Alpha/one'] }),
    ).split('\n')[0],
    '<!-- docs/architecture/decisions/alpha.md · 비가역: alpha.one.style, alpha.one.layout -->',
  );
});

test('the CLI reads the pack from the working tree and writes nothing', async () => {
  const { readDomainPack } = await helper();
  const json = cli('--pack', FIXTURE, '--sublayer', 'Fixture/Pack/Alpha/one');
  assert.equal(json.status, 0, json.stderr);
  const output = JSON.parse(json.stdout);
  assert.deepEqual(output.order, ['alpha.one.style', 'alpha.one.layout', 'alpha.one.copy']);
  assert.equal(output.pack, FIXTURE);

  const skeleton = cli('--pack', FIXTURE, '--sublayer', 'Fixture/Pack/beta/three', '--skeleton');
  assert.equal(skeleton.status, 0, skeleton.stderr);
  assert.match(skeleton.stdout, /^#### beta\.three\.retention$/mu);

  const unknown = cli('--pack', FIXTURE, '--sublayer', 'Fixture/Pack/Alpha/four');
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown sublayer/u);
  assert.equal(unknown.stdout, '');

  assert.deepEqual(readDomainPack(resolve(root, FIXTURE)), fixture());
  const source = readFileSync(resolve(root, CLI), 'utf8');
  for (const forbidden of [
    /\bwriteFile(?:Sync)?\s*\(/u,
    /\bmkdir(?:Sync)?\s*\(/u,
    /resolveArtifactPath/u,
  ])
    assert.doesNotMatch(source, forbidden);
});

test('the domain pack risk lists match the irreversible decisions the pack rule computes', async () => {
  const { analyzeDomainPack, readDomainPack } = await helper();
  const result = analyzeDomainPack(readDomainPack(resolve(root, PACK)));
  assert.ok(result.sublayers.length > 0);
  for (const sublayer of result.sublayers)
    assert.deepEqual(
      [...sublayer.irreversibleListed].sort(),
      ids(sublayer.decisions.filter(({ irreversible }) => irreversible)).sort(),
      sublayer.id,
    );
  assert.ok(result.sublayers.some(({ irreversibleListed }) => irreversibleListed.length > 0));
  assert.equal(result.order.length, new Set(result.order).size);
  assert.equal(result.order.length, result.sublayers.flatMap(({ decisions }) => decisions).length);
});
