// SP2 (b), OSS-REVIEW P5: a phrase in a review subject that tells the reviewer in advance what not to flag, how low to
// grade or that a plan already chose. It warns next to the implementation marker and is counted in the packet; it
// never refuses, rewrites or removes the subject. Group A is the superpowers review skill wording, B its Korean
// counterparts (readiness sample, OSS-REVIEW P5). A general "무시" and scope narrowing are not pre-judging phrases.
// Rules: docs/development/agent-workflows/review-criteria/README.md#센서-동작
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EDIT_SENSOR_SCHEMA, appendEditSensorActivation } from './edit-sensors.mjs';

export const PREJUDGMENT_SENSOR = 'review-prejudgment-phrase';
export const PREJUDGMENT_PHRASES = {
  'A-en':
    /(do not flag|don'?t flag|don'?t treat .{1,40} as a defect|at most minor|the plan chose)/iu,
  'B-ko-flag':
    /(지적하지\s*(말|마|않아도)|finding(으로|을)\s*(내지|올리지|만들지)\s*(말|마|않)|문제\s*삼지\s*(말|마|않))/u,
  'B-ko-defect': /(결함으로\s*(보지|치지|세지|판정하지)\s*(말|마|않)|결함이\s*아니(다|므로|니))/u,
  'B-ko-cap': /((최대|많아야|높아야)\s*`?(low|medium|minor)`?|`?(low|minor)`?\s*이하(로|만))/iu,
  'B-ko-chose': /((plan|계획)이\s*(이미\s*)?(골랐|정했|선택했)(으니|으므로|기\s*때문))/u,
};
// Sentences end after `다`, `요` or `)` with a period, or at a line break (the readiness sample split).
const SENTENCE = /(?<=[다요])\.\s+|(?<=\))\.\s+|\n/u;
const FIELDS = ['request', 'acceptance', 'requirements'];
const texts = (value) =>
  (typeof value === 'string' ? [value] : Array.isArray(value) ? value : []).filter(
    (text) => typeof text === 'string',
  );

// One match per sentence, the first group that finds a phrase in it.
export function prejudgmentPhraseMatches(subject = {}) {
  const matches = [];
  for (const field of FIELDS)
    for (const text of texts(subject[field]))
      for (const sentence of text
        .split(SENTENCE)
        .map((part) => part.trim())
        .filter(Boolean))
        for (const [group, pattern] of Object.entries(PREJUDGMENT_PHRASES)) {
          const found = pattern.exec(sentence);
          if (!found) continue;
          matches.push({ field, group, phrase: found[0], sentence: sentence.slice(0, 200) });
          break;
        }
  return matches;
}

export const prejudgmentWarning = (count) =>
  `review-prejudgment-phrase: ${count} sentence(s) pre-judge the review (what not to flag, a severity cap or a plan's choice); the reviewer still judges each item from the source (knu-review)`;

// The review point record for a session; the helper and the Codex CLI step call it only when there is a phrase.
export function recordPrejudgment({
  root,
  sessionId,
  host,
  matches,
  now = new Date().toISOString(),
}) {
  appendEditSensorActivation(realpathSync(root), sessionId, {
    schema: EDIT_SENSOR_SCHEMA,
    at: now,
    host,
    sessionId,
    agent: 'parent',
    point: '리뷰',
    sensor: PREJUDGMENT_SENSOR,
    criteria: [],
    file: null,
    sha256: null,
    result: 'warning',
    detail: `${matches.length} ${[...new Set(matches.map(({ group }) => group))].join(',')}`,
  });
}

const USAGE =
  'usage: review-prejudgment-phrases.mjs --input SUBJECT.json [--session ID --host claude|codex] [--root DIR]';
function main(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const [flag, value] = [args[index], args[index + 1]];
    if (!['--input', '--session', '--host', '--root'].includes(flag) || value === undefined) {
      options.invalid = true;
      break;
    }
    options[flag] = value;
  }
  if (options.invalid || !options['--input'] || (options['--session'] && !options['--host'])) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  let subject;
  try {
    subject = JSON.parse(readFileSync(options['--input'], 'utf8'));
  } catch (error) {
    process.stderr.write(`${USAGE}\n${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  const matches = prejudgmentPhraseMatches(subject);
  if (matches.length && options['--session'])
    try {
      recordPrejudgment({
        root: options['--root'] ?? process.cwd(),
        sessionId: options['--session'],
        host: options['--host'],
        matches,
      });
    } catch (error) {
      process.stderr.write(`KNU prejudgment record failed: ${error.message}\n`);
    }
  process.stdout.write(
    `${JSON.stringify(
      matches.length
        ? { count: matches.length, warning: prejudgmentWarning(matches.length), matches }
        : { count: 0, matches: [] },
    )}\n`,
  );
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
