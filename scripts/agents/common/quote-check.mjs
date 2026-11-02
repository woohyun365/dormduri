#!/usr/bin/env node
// Host-neutral quote check (DA-024). A researcher answers with claims {url, quote, checkedAt}; the Parent picks
// the claims it will move into evidence and fetches each URL's raw source itself (curl or similar, not a WebFetch
// summary). This check reads no network: for each selected claim it confirms the claim is in the child response,
// then whether the quote appears verbatim in the raw source after tag removal, entity decoding, whitespace folding
// and straight quotes. The output head binds the task id and the response digest that settlement compares.
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const QUOTE_CHECK_SCHEMA = 'knu-quote-check/v1';
export const QUOTE_CHECK_STATUSES = deepFreeze([
  'found',
  'missing',
  'raw-missing',
  'no-quote',
  'not-in-response',
]);
const RAW_LIMIT = 16 * 1024 * 1024;
const RESPONSE_LIMIT = 8 * 1024 * 1024;
const NESTING_LIMIT = 32;
const OUTPUT_FIELDS = [
  'schema',
  'taskId',
  'responseDigest',
  'results',
  'found',
  'excluded',
  'exit',
];
const RESULT_FIELDS = ['url', 'quote', 'checkedAt', 'status', 'raw', 'rawSha256', 'reason'];
const REASONS = deepFreeze({
  found: 'quote found verbatim in the raw source',
  missing: 'quote not found in the raw source',
  'raw-missing': 'no readable raw source file for this claim',
  'no-quote': 'the claim has no quote',
  'not-in-response': 'no claim with this url and quote in the child response',
});

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

// The settle observation's responseDigest: the same hash of the stored response value.
export function quoteCheckResponseDigest(response) {
  const value = response ?? null;
  return `sha256:${createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')}`;
}

function parsedObject(text) {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' ? value : undefined;
  } catch {
    return undefined;
  }
}

// JSON a text block carries: the whole text, else each fenced block. Read line by line, without a regular
// expression over the child's text.
function embeddedJson(text) {
  const whole = parsedObject(text.trim());
  if (whole !== undefined) return [whole];
  const found = [];
  let block = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (block === null) {
      if (trimmed.startsWith('```')) block = [];
    } else if (trimmed === '```') {
      const value = parsedObject(block.join('\n'));
      if (value !== undefined) found.push(value);
      block = null;
    } else block.push(line);
  }
  return found;
}

function collectClaims(value, claims, depth) {
  if (depth > NESTING_LIMIT) return;
  if (typeof value === 'string') {
    for (const parsed of embeddedJson(value)) collectClaims(parsed, claims, depth + 1);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectClaims(item, claims, depth + 1);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (typeof value.url === 'string')
    claims.push({
      url: value.url,
      quote: typeof value.quote === 'string' ? value.quote : null,
      checkedAt: typeof value.checkedAt === 'string' ? value.checkedAt : null,
    });
  for (const [key, child] of Object.entries(value))
    if (!['url', 'quote', 'checkedAt'].includes(key)) collectClaims(child, claims, depth + 1);
}

// The claims a child delivered. A response with a content array (a host completion record, which also stores the
// registered prompt) is read only through its text blocks; any other JSON value is read whole.
export function responseClaims(response) {
  const claims = [];
  if (response && typeof response === 'object' && Array.isArray(response.content)) {
    for (const block of response.content)
      if (block?.type === 'text' && typeof block.text === 'string')
        collectClaims(block.text, claims, 0);
  } else collectClaims(response, claims, 0);
  return claims;
}

const ENTITIES = deepFreeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: "'",
  rsquo: "'",
  sbquo: "'",
  ldquo: '"',
  rdquo: '"',
  bdquo: '"',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  middot: '·',
});
const ENTITY = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/gu;
function decodeEntity(match, body) {
  if (body[0] === '#') {
    const code =
      body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : match;
  }
  return Object.hasOwn(ENTITIES, body) ? ENTITIES[body] : match;
}

// Block tags (and <br>) become a space, so words of two blocks stay apart; any other tag is dropped, so a
// sentence with inline markup (`at <b>$5</b>.`) reads as written. A '<' that opens no tag (a letter, '/', '!'
// or '?' after it) and a '<' with no closing '>' stay text.
const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'caption',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);
function tagName(text, start) {
  let i = text[start] === '/' ? start + 1 : start;
  let name = '';
  while (i < text.length && /[a-zA-Z0-9]/u.test(text[i])) name += text[i++];
  return name.toLowerCase();
}
function withoutTags(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const next = text[i + 1] ?? '';
    if (text[i] === '<' && /[a-zA-Z/!?]/u.test(next)) {
      const end = text.indexOf('>', i + 1);
      // An unclosed '<' is text: dropping the rest would shorten a quote to a prefix that the source has.
      if (end === -1) return out + text.slice(i);
      if (BLOCK_TAGS.has(tagName(text, i + 1))) out += ' ';
      i = end + 1;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

// One entity-decoding pass (decoded text is never decoded again), straight quotes and folded whitespace.
function foldText(text) {
  return text
    .replace(ENTITY, decodeEntity)
    .replace(/[‘’‚‛′]/gu, "'")
    .replace(/[“”„‟″]/gu, '"')
    .replace(/\s+/gu, ' ')
    .trim();
}

// The raw source: tag removal, then folding.
export function normalizeQuoteText(text) {
  return foldText(withoutTags(text));
}

// A claim's quote is text copied from the page, not markup: it is folded but its tags are never removed, so a quote
// with a '<…>' piece the page does not show is not found (DA-024).
export function normalizeClaimQuote(text) {
  return foldText(text);
}

function rawSource(path) {
  if (typeof path !== 'string' || !path.trim()) return { reason: 'no raw source file named' };
  try {
    const size = statSync(path).size;
    if (size > RAW_LIMIT) return { reason: `raw source file over ${RAW_LIMIT} bytes` };
    const bytes = readFileSync(path);
    return {
      text: bytes.toString('utf8'),
      sha: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    };
  } catch (error) {
    return { reason: `raw source file unreadable (${error.code ?? 'error'})` };
  }
}

const sameClaim = (claim, selected) =>
  claim.url === selected.url && (claim.quote ?? '') === (selected.quote ?? '');

// One result per selected claim, in selection order. A selected claim is {url, quote, raw}; raw is the Parent's raw
// source file for that url.
export function checkQuotes({ taskId, response, selection }) {
  if (typeof taskId !== 'string' || !taskId.trim()) throw new TypeError('task id required');
  if (!Array.isArray(selection)) throw new TypeError('selection must be a JSON array');
  const claims = responseClaims(response);
  const results = selection.map((selected, index) => {
    if (
      !selected ||
      typeof selected !== 'object' ||
      Array.isArray(selected) ||
      typeof selected.url !== 'string' ||
      !selected.url ||
      !(
        selected.quote === undefined ||
        selected.quote === null ||
        typeof selected.quote === 'string'
      )
    )
      throw new TypeError(`selection[${index}] must be {url, quote, raw}`);
    const quote = typeof selected.quote === 'string' ? selected.quote : null;
    const claim = claims.find((item) => sameClaim(item, selected));
    const result = (status, raw = null) => ({
      url: selected.url,
      quote,
      checkedAt: claim?.checkedAt ?? null,
      status,
      raw: typeof selected.raw === 'string' ? selected.raw : null,
      rawSha256: raw?.sha ?? null,
      reason: raw?.reason ?? REASONS[status],
    });
    if (!claim) return result('not-in-response');
    if (!quote || !normalizeClaimQuote(quote)) return result('no-quote');
    const raw = rawSource(selected.raw);
    if (raw.text === undefined) return result('raw-missing', raw);
    return result(
      normalizeQuoteText(raw.text).includes(normalizeClaimQuote(quote)) ? 'found' : 'missing',
      { sha: raw.sha },
    );
  });
  const found = results.filter((item) => item.status === 'found').length;
  return {
    schema: QUOTE_CHECK_SCHEMA,
    taskId,
    responseDigest: quoteCheckResponseDigest(response),
    results,
    found,
    excluded: results.length - found,
    exit: found === results.length ? 0 : 1,
  };
}

// Settlement's gate on a quote-check output: it names this task and this response, and every claim it checked
// is in the child response. Statuses other than found are kept as exclusions, not refused (Owner 2026-10-31).
export function quoteCheckSettlement(output, { taskId, responseDigest, response }) {
  const errors = [];
  const shaped =
    output !== null &&
    typeof output === 'object' &&
    !Array.isArray(output) &&
    output.schema === QUOTE_CHECK_SCHEMA &&
    OUTPUT_FIELDS.every((key) => Object.hasOwn(output, key)) &&
    Array.isArray(output.results) &&
    output.results.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        RESULT_FIELDS.every((key) => Object.hasOwn(item, key)) &&
        typeof item.url === 'string' &&
        (item.quote === null || typeof item.quote === 'string') &&
        QUOTE_CHECK_STATUSES.includes(item.status),
    );
  if (!shaped) return { errors: ['quote-check-output-invalid'], candidates: [], excluded: [] };
  if (output.taskId !== taskId) errors.push('quote-check-task-mismatch');
  if (output.responseDigest !== responseDigest) errors.push('quote-check-response-mismatch');
  const claims = responseClaims(response);
  for (const item of output.results)
    if (!claims.some((claim) => sameClaim(claim, item)))
      errors.push(`quote-check-claim-not-in-response:${item.url}`);
  const pick = ({ url, quote, checkedAt, status, raw, rawSha256, reason }) => ({
    url,
    quote,
    checkedAt,
    status,
    raw,
    rawSha256,
    reason,
  });
  return {
    errors,
    candidates: output.results.filter((item) => item.status === 'found').map(pick),
    excluded: output.results.filter((item) => item.status !== 'found').map(pick),
  };
}

const USAGE =
  'usage: quote-check.mjs --task <taskId> --response <response JSON file> --select <selection JSON file> [--out <file>]';
function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      !['--task', '--response', '--select', '--out'].includes(args[i]) ||
      args[i + 1] === undefined
    )
      throw new TypeError(USAGE);
    options[args[i]] = args[i + 1];
  }
  if (!options['--task'] || !options['--response'] || !options['--select'])
    throw new TypeError(USAGE);
  const responsePath = resolve(options['--response']);
  if (statSync(responsePath).size > RESPONSE_LIMIT)
    throw new TypeError(`response file over ${RESPONSE_LIMIT} bytes`);
  const response = JSON.parse(readFileSync(responsePath, 'utf8'));
  const selection = JSON.parse(readFileSync(resolve(options['--select']), 'utf8'));
  const output = checkQuotes({ taskId: options['--task'], response, selection });
  const text = `${JSON.stringify(output, null, 2)}\n`;
  if (options['--out']) writeFileSync(resolve(options['--out']), text);
  process.stdout.write(text);
  return output.exit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`quote-check: ${error.message}\n`);
    process.exitCode = 2;
  }
}
