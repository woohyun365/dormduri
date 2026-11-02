import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Loaded in each test, so a missing module fails each case with its own reason.
const load = () => import('../../../agents/common/quote-check.mjs');

const cli = fileURLToPath(new URL('../../../agents/common/quote-check.mjs', import.meta.url));
const URL_A = 'https://docs.example.com/pricing';
const URL_B = 'https://docs.example.com/support';
const RAW_A = [
  '<html><body><h1>Pricing</h1>',
  '<p>The <b>Lightsail</b> plan costs   $5 per\n month &amp; includes 1&nbsp;TB.</p>',
  '<p>&ldquo;Two subagents editing the same file in parallel is a recipe for conflict.&rdquo;</p>',
  '</body></html>',
].join('\n');
const CLAIMS = [
  {
    url: URL_A,
    quote: 'The Lightsail plan costs $5 per month & includes 1 TB.',
    checkedAt: '2026-11-02',
  },
  {
    url: URL_A,
    quote: 'The Lightsail plan costs $5 per month &amp; includes 1 TB.',
    checkedAt: '2026-11-02',
  },
  { url: URL_A, quote: 'The  Lightsail\nplan costs $5', checkedAt: '2026-11-02' },
  {
    url: URL_A,
    quote: '"Two subagents editing the same file in parallel is a recipe for conflict."',
    checkedAt: '2026-11-02',
  },
  { url: URL_A, quote: 'The Lightsail plan costs $7 per month.', checkedAt: '2026-11-02' },
  { url: URL_B, quote: 'Support ends in 2027.', checkedAt: '2026-11-01' },
  { url: URL_A, checkedAt: '2026-11-02' },
];
// A host completion record: the delivered text holds the claims, and the stored prompt's example claim is no
// claim of the child.
const RESPONSE = {
  status: 'completed',
  agentId: 'child-1',
  prompt:
    'Answer as ```json\n{"claims":[{"url":"https://prompt.example/only","quote":"example"}]}\n```',
  content: [
    {
      type: 'text',
      text: `Findings:\n\n\`\`\`json\n${JSON.stringify({ claims: CLAIMS })}\n\`\`\`\n`,
    },
  ],
};

function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'quote-check-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'raw-a.html'), RAW_A);
  return dir;
}
const pick = (claim, raw) => ({ url: claim.url, quote: claim.quote, raw });

test('the response digest is the settle observation hash and claims come only from delivered text', async () => {
  const { quoteCheckResponseDigest, responseClaims } = await load();
  assert.equal(
    quoteCheckResponseDigest(RESPONSE),
    `sha256:${createHash('sha256').update(JSON.stringify(RESPONSE)).digest('hex')}`,
  );
  const claims = responseClaims(RESPONSE);
  assert.equal(claims.length, CLAIMS.length);
  assert.ok(!claims.some((claim) => claim.url === 'https://prompt.example/only'));
  // A plain JSON value (another host's handoff) is read whole.
  assert.deepEqual(responseClaims({ claims: [CLAIMS[0]] }), [CLAIMS[0]]);
});

test('normalization folds tags, entities, whitespace and curly quotes once', async () => {
  const { normalizeQuoteText } = await load();
  assert.equal(normalizeQuoteText('<p>a&nbsp;&amp;\n  b</p>'), 'a & b');
  assert.equal(normalizeQuoteText('“q” ‘r’'), '"q" \'r\'');
  // Decoded text is not decoded again, and a '<' that opens no tag stays text.
  assert.equal(normalizeQuoteText('&amp;lt;b&amp;gt;'), '&lt;b&gt;');
  assert.equal(normalizeQuoteText('1 < 2 and 3 > 2'), '1 < 2 and 3 > 2');
});

test('each selected claim gets one of five results and the exit is 0 only when all are found', async (t) => {
  const { QUOTE_CHECK_SCHEMA, checkQuotes, quoteCheckResponseDigest } = await load();
  const dir = workspace(t);
  const raw = join(dir, 'raw-a.html');
  const output = checkQuotes({
    taskId: 'task-1',
    response: RESPONSE,
    selection: [
      pick(CLAIMS[0], raw),
      pick(CLAIMS[1], raw),
      pick(CLAIMS[2], raw),
      pick(CLAIMS[3], raw),
      pick(CLAIMS[4], raw),
      pick(CLAIMS[5], join(dir, 'absent.html')),
      { url: URL_A, raw },
      { url: URL_A, quote: 'Not what the child said.', raw },
      { url: 'https://docs.example.com/other', quote: CLAIMS[0].quote, raw },
    ],
  });
  assert.equal(output.schema, QUOTE_CHECK_SCHEMA);
  assert.equal(output.taskId, 'task-1');
  assert.equal(output.responseDigest, quoteCheckResponseDigest(RESPONSE));
  assert.deepEqual(
    output.results.map((item) => item.status),
    [
      'found',
      'found',
      'found',
      'found',
      'missing',
      'raw-missing',
      'no-quote',
      'not-in-response',
      'not-in-response',
    ],
  );
  const sha = `sha256:${createHash('sha256').update(readFileSync(raw)).digest('hex')}`;
  assert.equal(output.results[0].rawSha256, sha);
  assert.equal(output.results[0].checkedAt, '2026-11-02');
  assert.equal(output.results[5].rawSha256, null);
  assert.equal(output.found, 4);
  assert.equal(output.excluded, 5);
  assert.equal(output.exit, 1);
  const empty = checkQuotes({ taskId: 'task-1', response: RESPONSE, selection: [] });
  assert.deepEqual([empty.results, empty.exit], [[], 0]);
});

test('the CLI reads files only and exits 0, 1 or 2', async (t) => {
  const { quoteCheckResponseDigest } = await load();
  const dir = workspace(t);
  const responseFile = join(dir, 'response.json');
  writeFileSync(responseFile, JSON.stringify(RESPONSE, null, 2));
  const run = (selection, extra = []) => {
    const selectFile = join(dir, 'select.json');
    writeFileSync(selectFile, JSON.stringify(selection));
    return spawnSync(
      process.execPath,
      [cli, '--task', 'task-1', '--response', responseFile, '--select', selectFile, ...extra],
      { cwd: dir, encoding: 'utf8' },
    );
  };
  const found = run([pick(CLAIMS[0], 'raw-a.html')], ['--out', 'out.json']);
  assert.equal(found.status, 0, found.stderr);
  const written = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'));
  assert.deepEqual(JSON.parse(found.stdout), written);
  // The digest of a re-indented file is still the stored response's hash.
  assert.equal(written.responseDigest, quoteCheckResponseDigest(RESPONSE));
  assert.equal(run([pick(CLAIMS[4], 'raw-a.html')]).status, 1);
  assert.equal(run([]).status, 0);
  const usage = spawnSync(process.execPath, [cli, '--task', 'task-1'], { encoding: 'utf8' });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: quote-check\.mjs/u);
  assert.doesNotMatch(readFileSync(cli, 'utf8'), /\bfetch\(|node:https?['"]|node:net['"]/u);
});

test('settlement keeps the output bound to its task, response and claims and splits candidates', async (t) => {
  const { checkQuotes, quoteCheckSettlement } = await load();
  const dir = workspace(t);
  const raw = join(dir, 'raw-a.html');
  const output = checkQuotes({
    taskId: 'task-1',
    response: RESPONSE,
    selection: [pick(CLAIMS[0], raw), pick(CLAIMS[4], raw), { url: URL_A, raw }],
  });
  const bound = { taskId: 'task-1', responseDigest: output.responseDigest, response: RESPONSE };
  const settled = quoteCheckSettlement(output, bound);
  assert.deepEqual(settled.errors, []);
  assert.deepEqual(
    settled.candidates.map((item) => item.quote),
    [CLAIMS[0].quote],
  );
  assert.deepEqual(
    settled.excluded.map((item) => [item.status, item.reason]),
    [
      ['missing', 'quote not found in the raw source'],
      ['no-quote', 'the claim has no quote'],
    ],
  );
  assert.deepEqual(quoteCheckSettlement(output, { ...bound, taskId: 'task-2' }).errors, [
    'quote-check-task-mismatch',
  ]);
  assert.deepEqual(
    quoteCheckSettlement(output, { ...bound, responseDigest: `sha256:${'0'.repeat(64)}` }).errors,
    ['quote-check-response-mismatch'],
  );
  const foreign = structuredClone(output);
  foreign.results[0].quote = 'A quote the child never gave.';
  assert.deepEqual(quoteCheckSettlement(foreign, bound).errors, [
    `quote-check-claim-not-in-response:${URL_A}`,
  ]);
  assert.deepEqual(quoteCheckSettlement({ schema: 'other' }, bound).errors, [
    'quote-check-output-invalid',
  ]);
});

test('inline markup inside a sentence is dropped and block tags keep words apart', async () => {
  const { normalizeQuoteText } = await load();
  assert.equal(
    normalizeQuoteText('<p>Bundles start at <b>$5&nbsp;USD/month</b>.</p><p>Next</p>'),
    'Bundles start at $5 USD/month. Next',
  );
  assert.equal(normalizeQuoteText('one<br>two<BR/>three'), 'one two three');
  assert.equal(
    normalizeQuoteText('a <a href="/x">link</a>, then <!-- note --> more'),
    'a link, then more',
  );
  // An unclosed '<' keeps the rest, so a quote is never cut to a prefix the source has.
  assert.equal(normalizeQuoteText('costs $5<later rise'), 'costs $5<later rise');
  assert.equal(
    normalizeQuoteText('<p>costs $5 per month</p>').includes(
      normalizeQuoteText('costs $5<b later'),
    ),
    false,
  );
});

test('the CLI exits 2 for a response or selection it cannot read or a malformed selected claim', async (t) => {
  await load();
  const dir = workspace(t);
  const responseFile = join(dir, 'response.json');
  writeFileSync(responseFile, JSON.stringify(RESPONSE));
  const run = (response, selection) => {
    const selectFile = join(dir, 'select.json');
    writeFileSync(selectFile, selection);
    return spawnSync(
      process.execPath,
      [cli, '--task', 'task-1', '--response', response, '--select', selectFile],
      { cwd: dir, encoding: 'utf8' },
    );
  };
  for (const [name, response, selection] of [
    ['missing response file', join(dir, 'absent.json'), '[]'],
    ['response not JSON', join(dir, 'select.json'), 'not json'],
    ['selection not JSON', responseFile, 'not json'],
    ['selection not an array', responseFile, '{}'],
    [
      'selected claim without url',
      responseFile,
      JSON.stringify([{ quote: 'x', raw: 'raw-a.html' }]),
    ],
  ]) {
    const result = run(response, selection);
    assert.equal(result.status, 2, `${name}: ${result.stderr}`);
    assert.equal(result.stdout, '', name);
  }
});

test('tags are removed from the raw source only, so a quote with markup the page does not show is missing', async (t) => {
  const { checkQuotes } = await load();
  const dir = workspace(t);
  const raw = join(dir, 'raw-tags.html');
  writeFileSync(raw, '<p>The plan costs $5 per month.</p><p>Use &lt;b&gt; for bold.</p>');
  const url = 'https://example.com/tags';
  const quotes = [
    'costs $5 <a not in source> per month',
    'costs $5 per month',
    'Use <b> for bold.',
    '<b>',
    '<p>The plan',
  ];
  const response = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          claims: quotes.map((quote) => ({ url, quote, checkedAt: '2026-11-02' })),
        }),
      },
    ],
  };
  const output = checkQuotes({
    taskId: 'task-tags',
    response,
    selection: quotes.map((quote) => ({ url, quote, raw })),
  });
  assert.deepEqual(
    output.results.map((item) => [item.quote, item.status]),
    [
      ['costs $5 <a not in source> per month', 'missing'],
      ['costs $5 per month', 'found'],
      ['Use <b> for bold.', 'found'],
      // The page shows '<b>' as text (&lt;b&gt;) but never shows its own <p> tag.
      ['<b>', 'found'],
      ['<p>The plan', 'missing'],
    ],
  );
  assert.equal(output.exit, 1);
});
