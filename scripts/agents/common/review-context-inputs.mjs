#!/usr/bin/env node
// Reviewer context inputs: the records a reviewer reads beside the subject to judge it against what was
// intended, decided and required. From the review target paths it lists the product intent
// (`docs/product/intent.md`, when present), the decision record of each layer the automatic criteria
// selection picks (`docs/architecture/decisions/<layer>.md`, when present), the policy document of each
// policy domain the Lifecycle gate judges for the product paths (its path table functions are imported,
// not copied), the binding rows tied to the selected criteria documents and the Lifecycle section of the
// change-grade draft given for the review. The last two are extracts: the caller writes each one to the
// path its input names. Every input carries its reason. The binding document itself is not an input, and
// no host policy is imported.
// Rules: docs/development/agent-workflows/review-criteria/README.md (리뷰어 입력)
//
// Usage: node scripts/agents/common/review-context-inputs.mjs [--root <dir>] [--binding-out <path>]
//          [--lifecycle-draft <path> --lifecycle-out <path>] -- <path>...
// Exit 0 = the record on stdout (and the extracts at their output paths), 1 = an input it cannot read
// (criteria catalog, path table, binding sections, pack, draft) or an extract without a usable output path,
// 2 = usage error.
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeDomainPack, readDomainPack } from './discovery-questions.mjs';
import {
  REVIEW_BINDING_PATH,
  REVIEW_PACK_DIR,
  loadReviewCriteriaCatalog,
  selectReviewCriteria,
} from './review-criteria-selection.mjs';
import {
  PATH_DOMAINS_FILE,
  createPathTable,
  parsePathDomains,
  policyPath,
} from '../../ci/lifecycle/policy-first-check.mjs';

export const REVIEW_CONTEXT_INPUTS_SCHEMA = 'review-context-inputs/v1';
export const INTENT_PATH = 'docs/product/intent.md';
export const DECISIONS_DIR = 'docs/architecture/decisions';
// Every input kind in record order; the two extract kinds take an output path (the CLI flag beside each).
export const REVIEW_CONTEXT_KINDS = [
  'intent',
  'decision',
  'policy',
  'binding-values',
  'lifecycle-draft',
];
export const CONTEXT_OUTPUT_FLAGS = {
  'binding-values': '--binding-out',
  'lifecycle-draft': '--lifecycle-out',
};
const LIFECYCLE_HEADING = /^## Lifecycle[ \t]*$/u;
const VALUES_HEADING = '## 고른 값';
const CONVENTIONS_HEADING = '## 저장소 규약';
const TABLE_SEPARATOR = /^\|(?:\s*:?-+:?\s*\|)+\s*$/u;

const fail = (message) => {
  throw new TypeError(message);
};
const isFile = (root, path) => {
  try {
    return lstatSync(join(root, path)).isFile();
  } catch {
    return false;
  }
};
const sorted = (values) => [...new Set(values)].sort();
const repositoryPath = (root, path) => relative(root, resolve(root, normalize(path)));

// A draft path relative to the root that names a regular file.
function lifecycleDraftPath(root, draft) {
  if (typeof draft !== 'string' || !draft.trim() || isAbsolute(draft))
    fail(`lifecycle-draft-invalid: ${JSON.stringify(draft)} is not a repository-relative path`);
  const path = repositoryPath(root, draft);
  if (!path || path.startsWith('..'))
    fail(`lifecycle-draft-invalid: ${draft} is outside the repository`);
  if (!isFile(root, path)) fail(`lifecycle-draft-invalid: ${draft} is not a readable file`);
  return path;
}
// The draft's one `## Lifecycle` section, from its heading to the next `## ` heading, byte for byte.
function lifecycleSection(draft, text) {
  const lines = text.split('\n');
  const at = lines.flatMap((line, index) => (LIFECYCLE_HEADING.test(line) ? [index] : []));
  if (!at.length) fail(`lifecycle-draft-invalid: ${draft} has no "## Lifecycle" section`);
  if (at.length > 1)
    fail(`lifecycle-draft-invalid: ${draft} has more than one "## Lifecycle" section`);
  const next = lines.findIndex((line, index) => index > at[0] && /^## /u.test(line));
  return lines.slice(at[0], next === -1 ? lines.length : next).join('\n');
}

// Layer → the target paths and criteria documents that brought it in, from the automatic selection.
function selectedLayers(documents) {
  const layers = new Map();
  for (const document of documents.filter(({ layer }) => layer !== null)) {
    if (!layers.has(document.layer)) layers.set(document.layer, { documents: [], paths: [] });
    const entry = layers.get(document.layer);
    entry.documents.push(document.id);
    entry.paths.push(
      ...document.reasons.filter((reason) => reason.rule === 'path-key').map(({ path }) => path),
    );
  }
  return layers;
}

// Domain → the product paths the gate's path table judged into it; none without a path table.
function judgedDomains(root, paths) {
  const domains = new Map();
  if (!existsSync(join(root, PATH_DOMAINS_FILE))) return domains;
  const table = createPathTable(
    parsePathDomains(readFileSync(join(root, PATH_DOMAINS_FILE), 'utf8')),
  );
  for (const path of paths.filter(table.isProductPath))
    for (const domain of table.domainsOf(path)) {
      if (!domains.has(domain)) domains.set(domain, []);
      domains.get(domain).push(path);
    }
  return domains;
}

const cellsOf = (line) =>
  line
    .split(/(?<!\\)\|/u)
    .slice(1, -1)
    .map((cell) => cell.trim());
// One `## ` section of the binding, its heading through the line before the next `## ` heading; null when
// the binding has no such section. A heading that only starts with the name (a renamed section) stops the
// extract instead of passing zero rows.
function bindingSection(lines, heading) {
  const at = lines.flatMap((line, index) => (line.trimEnd() === heading ? [index] : []));
  if (!at.length) {
    const renamed = lines.find((line) => line.startsWith(heading));
    if (renamed !== undefined)
      fail(
        `binding-values-invalid: ${REVIEW_BINDING_PATH} has "${renamed.trimEnd()}", not "${heading}"`,
      );
    return null;
  }
  if (at.length > 1) fail(`binding-values-invalid: ${REVIEW_BINDING_PATH} repeats "${heading}"`);
  const next = lines.findIndex((line, index) => index > at[0] && /^## /u.test(line));
  return lines.slice(at[0], next === -1 ? lines.length : next);
}
// What an extract copies from a section: the heading, the column bullets above the table, the header and
// separator lines and the rows. A section whose table header lacks the named column is refused.
function bindingTable(section, column) {
  const at = section.findIndex((line) => line.startsWith('|'));
  const index = at === -1 ? -1 : cellsOf(section[at]).indexOf(column);
  if (index === -1 || !TABLE_SEPARATOR.test(section[at + 1] ?? ''))
    fail(
      `binding-values-invalid: ${section[0].trim()} has no table whose header names "${column}"`,
    );
  const bullets = [];
  let item = false;
  for (const line of section.slice(1, at)) {
    item = /^- /u.test(line) || (item && /^\s+\S/u.test(line));
    if (item) bullets.push(line);
  }
  const rows = [];
  for (const line of section.slice(at + 2)) {
    if (!line.startsWith('|')) break;
    const cell = cellsOf(line)[index];
    if (cell === undefined)
      fail(`binding-values-invalid: ${section[0].trim()} row ${line} is short`);
    rows.push({ line, cell, first: cellsOf(line)[0] });
  }
  return { heading: section[0], bullets, header: section.slice(at, at + 2), rows };
}
// Pack decision id → the criteria document of its sublayer (`web-<layer file>-<sublayer>`, the id the
// selection gives that sublayer section; a row whose id the catalog lacks stops the extract, so the two never
// drift apart silently). A pack the discovery parser refuses stops the extract.
function decisionDocuments(root) {
  const documents = new Map();
  let pack;
  try {
    pack = analyzeDomainPack(readDomainPack(join(root, REVIEW_PACK_DIR)));
  } catch (error) {
    fail(`binding-values-invalid: pack ${REVIEW_PACK_DIR}: ${error.message}`);
  }
  for (const sublayer of pack.sublayers)
    for (const { id } of sublayer.decisions)
      documents.set(id, `web-${sublayer.document.slice(0, -'.md'.length)}-${sublayer.name}`);
  return documents;
}

// The binding rows tied to the selected criteria documents: a `## 고른 값` row whose decision (before
// `/<영역>`) is in a selected document's pack sublayer, and a `## 저장소 규약` row whose related criteria item
// names a selected document. Lines are copied unchanged in binding order under a first line naming the
// binding and its sha256, from which the copied relative links resolve. Null when no row is tied. `known` is
// every criteria document id of the catalog; a row tied to any other id stops the extract.
function bindingValues(root, selected, known) {
  if (!isFile(root, REVIEW_BINDING_PATH)) return null;
  const bytes = readFileSync(join(root, REVIEW_BINDING_PATH));
  const lines = bytes.toString('utf8').split('\n');
  const valuesSection = bindingSection(lines, VALUES_HEADING);
  const conventionsSection = bindingSection(lines, CONVENTIONS_HEADING);
  const values = valuesSection && bindingTable(valuesSection, '결정');
  const conventions = conventionsSection && bindingTable(conventionsSection, '관련 기준 항목');
  const decisions = [];
  if (values?.rows.length) {
    const documents = decisionDocuments(root);
    for (const row of values.rows) {
      const id = /^`([^`/]+)(?:\/[^`]+)?`$/u.exec(row.cell)?.[1];
      if (!id)
        fail(`binding-values-invalid: ${VALUES_HEADING} row ${row.cell} is not a decision id`);
      const document = documents.get(id);
      if (!document)
        fail(`binding-values-invalid: ${VALUES_HEADING} row ${id} is not a pack decision`);
      if (!known.has(document))
        fail(
          `binding-values-invalid: ${VALUES_HEADING} row ${id} maps to ${document}, not a criteria document`,
        );
      if (selected.has(document)) decisions.push({ ...row, document });
    }
  }
  const facts = [];
  for (const row of conventions?.rows ?? []) {
    const named = [...row.cell.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)*)\.md [A-Z]+[0-9]+`/gu)].map(
      ([, id]) => id,
    );
    if (!named.length)
      fail(
        `binding-values-invalid: ${CONVENTIONS_HEADING} row ${row.first} names no criteria item`,
      );
    const unknown = named.filter((id) => !known.has(id));
    if (unknown.length)
      fail(
        `binding-values-invalid: ${CONVENTIONS_HEADING} row ${row.first} names ${unknown.join(', ')}, not a criteria document`,
      );
    const documents = sorted(named.filter((id) => selected.has(id)));
    if (documents.length) facts.push({ ...row, documents });
  }
  if (!decisions.length && !facts.length) return null;
  const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const text = [
    `Copied from ${REVIEW_BINDING_PATH} ${sha256}. Relative links resolve from that file.`,
  ];
  for (const [table, rows] of [
    [values, decisions],
    [conventions, facts],
  ])
    if (rows.length)
      text.push(
        '',
        table.heading,
        '',
        ...(table.bullets.length ? [...table.bullets, ''] : []),
        ...table.header,
        ...rows.map(({ line }) => line),
      );
  return {
    text: `${text.join('\n')}\n`,
    reason: {
      rule: 'binding-values',
      binding: REVIEW_BINDING_PATH,
      sha256,
      decisions: decisions.map(({ cell, document }) => ({ row: cell.slice(1, -1), document })),
      conventions: facts.map(({ first, documents }) => ({ fact: first, documents })),
    },
  };
}

// The context of one review before its extracts have a place: the input record (intent, decision records
// by layer, policy documents by domain, then the binding rows and the draft section, whose `path` stays null)
// and each extract's text by kind. Layer and domain inputs whose file is missing are kept under `absent`, not
// as read paths. A subject without changed paths (a read-only task) still takes the intent and the draft.
export function collectReviewContext({ root = process.cwd(), paths, lifecycleDraft } = {}) {
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !path))
    fail('context-paths-invalid: a list of repository paths is required');
  root = realpathSync(root);
  const unique = [...new Set(paths.map((path) => path.replace(/^\.\//u, '')))];
  const draft = lifecycleDraft === undefined ? null : lifecycleDraftPath(root, lifecycleDraft);
  const extracts = {};
  if (draft !== null)
    extracts['lifecycle-draft'] = lifecycleSection(draft, readFileSync(join(root, draft), 'utf8'));
  const inputs = [];
  const absent = [];
  if (isFile(root, INTENT_PATH))
    inputs.push({ kind: 'intent', path: INTENT_PATH, reason: { rule: 'intent' } });
  const catalog = loadReviewCriteriaCatalog(root);
  const { documents } = selectReviewCriteria({ paths: unique, catalog });
  const layers = selectedLayers(documents);
  for (const layer of sorted(layers.keys())) {
    const path = `${DECISIONS_DIR}/${layer}.md`;
    if (!isFile(root, path)) {
      absent.push({ kind: 'decision', path, layer });
      continue;
    }
    const { documents: chosen, paths: matched } = layers.get(layer);
    inputs.push({
      kind: 'decision',
      path,
      reason: { rule: 'layer', layer, documents: sorted(chosen), paths: sorted(matched) },
    });
  }
  const domains = judgedDomains(root, unique);
  for (const domain of sorted(domains.keys())) {
    const path = policyPath(domain);
    if (!isFile(root, path)) {
      absent.push({ kind: 'policy', path, domain });
      continue;
    }
    inputs.push({
      kind: 'policy',
      path,
      reason: { rule: 'policy-domain', domain, paths: sorted(domains.get(domain)) },
    });
  }
  const binding = bindingValues(
    root,
    new Set(documents.map(({ id }) => id)),
    new Set(Object.keys(catalog.documents)),
  );
  if (binding !== null) {
    extracts['binding-values'] = binding.text;
    inputs.push({ kind: 'binding-values', path: null, reason: binding.reason });
  }
  if (draft !== null)
    inputs.push({
      kind: 'lifecycle-draft',
      path: null,
      reason: { rule: 'lifecycle-draft', draft },
    });
  return {
    root,
    record: { schema: REVIEW_CONTEXT_INPUTS_SCHEMA, paths: unique, inputs, absent },
    extracts,
  };
}

// The record with each extract input at its output path (`outputs` maps an extract kind to a repository-relative
// path). An extract without an output, and an output that is absolute, outside the root or the same as a review
// path, a source or another output (compared without case, which a case-insensitive filesystem ignores), are
// refused. An output for a kind with no extract is checked and unused.
export function placeReviewContext({ root, record, extracts }, outputs = {}) {
  const sources = new Set(
    [
      ...record.paths,
      REVIEW_BINDING_PATH,
      ...record.inputs.flatMap((input) => [input.path, input.reason.draft]).filter(Boolean),
    ].map((path) => path.toLowerCase()),
  );
  const placed = {};
  for (const [kind, output] of Object.entries(outputs)) {
    const flag = CONTEXT_OUTPUT_FLAGS[kind];
    if (!flag) fail(`context-output-invalid: ${kind} is not an extract kind`);
    if (typeof output !== 'string' || !output.trim() || isAbsolute(output))
      fail(
        `context-output-invalid: ${flag} ${JSON.stringify(output)} is not a repository-relative path`,
      );
    const path = repositoryPath(root, output);
    if (!path || path.startsWith('..'))
      fail(`context-output-invalid: ${flag} ${output} is outside the repository`);
    if (sources.has(path.toLowerCase()))
      fail(
        `context-output-invalid: ${flag} ${output} is a review path, a source or another output`,
      );
    placed[kind] = path;
    sources.add(path.toLowerCase());
  }
  for (const kind of Object.keys(extracts))
    if (!placed[kind])
      fail(
        `context-output-missing: the ${kind} extract needs ${CONTEXT_OUTPUT_FLAGS[kind]} <path>`,
      );
  return {
    ...record,
    inputs: record.inputs.map((input) =>
      Object.hasOwn(extracts, input.kind) ? { ...input, path: placed[input.kind] } : input,
    ),
  };
}

// The input record of one review with its extracts at `outputs` (nothing is written).
export function reviewContextInputs({ root = process.cwd(), paths, lifecycleDraft, outputs } = {}) {
  return placeReviewContext(collectReviewContext({ root, paths, lifecycleDraft }), outputs);
}

// Writes an extract at its repository-relative output path: missing directories are made and a regular file is
// replaced (the same review built again), but a symlink at the path or above it inside the root is refused, so
// the file the record names is the file written.
export function writeReviewContextExtract(root, path, text) {
  root = realpathSync(root);
  const parts = path.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (stat === undefined) mkdirSync(current);
    else if (stat.isSymbolicLink() || !stat.isDirectory())
      fail(`context-output-invalid: ${path} has a symlink or a file above it`);
  }
  const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
  if (stat !== undefined && (stat.isSymbolicLink() || !stat.isFile()))
    fail(`context-output-invalid: ${path} is a symlink or not a regular file`);
  writeFileSync(join(root, path), text);
}

// The short reason a reviewer input line shows beside each path.
export function contextInputLabel(input) {
  if (input.kind === 'intent') return 'product intent';
  if (input.kind === 'decision') return `decision record, layer ${input.reason.layer}`;
  if (input.kind === 'policy') return `policy, domain ${input.reason.domain}`;
  if (input.kind === 'binding-values')
    return `binding rows for the selected criteria: chosen values ${input.reason.decisions.length}, repository conventions ${input.reason.conventions.length}`;
  if (input.kind === 'lifecycle-draft') return 'Lifecycle draft given for this review';
  return fail(`context-input-invalid: ${input.kind}`);
}

const VALUE_FLAGS = ['--root', '--lifecycle-draft', ...Object.values(CONTEXT_OUTPUT_FLAGS)];
function main(argv) {
  let root = process.cwd();
  let lifecycleDraft;
  const outputs = {};
  const paths = [];
  let usage = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      paths.push(...argv.slice(i + 1));
      break;
    }
    if (VALUE_FLAGS.includes(arg)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith('-')) usage = true;
      else if (arg === '--root') root = value;
      else if (arg === '--lifecycle-draft') lifecycleDraft = value;
      else
        outputs[
          Object.keys(CONTEXT_OUTPUT_FLAGS).find((kind) => CONTEXT_OUTPUT_FLAGS[kind] === arg)
        ] = value;
    }
    // A misspelled or `--option=value` flag is a usage error, never a review path.
    else if (arg.startsWith('-')) usage = true;
    else paths.push(arg);
  }
  if (usage || !paths.length) {
    process.stderr.write(
      'usage: review-context-inputs.mjs [--root <dir>] [--binding-out <path>] [--lifecycle-draft <path> --lifecycle-out <path>] -- <path>...\n',
    );
    return 2;
  }
  try {
    const context = collectReviewContext({ root, paths, lifecycleDraft });
    const record = placeReviewContext(context, outputs);
    for (const input of record.inputs)
      if (Object.hasOwn(context.extracts, input.kind))
        writeReviewContextExtract(context.root, input.path, context.extracts[input.kind]);
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = main(process.argv.slice(2));
